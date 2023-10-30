/*
COPIED AND MODIFIED FROM https://github.com/disney/terraform-aws-kinesis-firehose-splunk
UNDER THE TOMORROW OPEN SOURCE TECHNOLOGY LICENSE
*/

/*
For processing data sent to Firehose by Cloudwatch Logs subscription filters.

Cloudwatch Logs sends to Firehose records that look like this:

{
  "messageType": "DATA_MESSAGE",
  "owner": "123456789012",
  "logGroup": "log_group_name",
  "logStream": "log_stream_name",
  "subscriptionFilters": [
    "subscription_filter_name"
  ],
  "logEvents": [
    {
      "id": "01234567890123456789012345678901234567890123456789012345",
      "timestamp": 1510109208016,
      "message": "log message 1"
    },
    {
      "id": "01234567890123456789012345678901234567890123456789012345",
      "timestamp": 1510109208017,
      "message": "log message 2"
    }
    ...
  ]
}

The data is additionally compressed with GZIP.

The code below will:

1) Gunzip the data
2) Parse the json
3) Set the result to ProcessingFailed for any record whose messageType is not DATA_MESSAGE, thus redirecting them to the
   processing error output. Such records do not contain any log events. You can modify the code to set the result to
   Dropped instead to get rid of these records completely.
4) For records whose messageType is DATA_MESSAGE, extract the individual log events from the logEvents field, and pass
   each one to the transformLogEvent method. You can modify the transformLogEvent method to perform custom
   transformations on the log events.
5) Concatenate the result from (4) together and set the result as the data of the record returned to Firehose. Note that
   this step will not add any delimiters. Delimiters should be appended by the logic within the transformLogEvent
   method.
6) Any additional records which exceed 6MB will be re-ingested back into Firehose.
*/
const zlib = require("zlib")
const {Firehose} = require("@aws-sdk/client-firehose")
const {Kinesis} = require("@aws-sdk/client-kinesis")
const {Logger} = require("@aws-lambda-powertools/logger")
const helpers = require("./helpers.js")

const ENV = process.env.ENV
const LOG_LEVEL = process.env.LOG_LEVEL
const logger = new Logger({serviceName: "splunkProcessor", logLevel: LOG_LEVEL})

/**
 * logEvent has this format:
 *
 * {
 *   "id": "01234567890123456789012345678901234567890123456789012345",
 *   "timestamp": 1510109208016,
 *   "message": "log message 1"
 * }
 *
 * The default implementation below just extracts the message and appends a newline to it.
 *
 * The result must be returned as a string Promise.
 *
 * The index is configured by the HEC token
 */
const SPLUNK_SOURCE_TYPE = "aws:cloudwatch"

function transformLambdaLogEvent(logEvent) {
  let eventMessage
  let functionRequestId = ""
  const summaryPattern = /RequestId:\s*([a-fA-F0-9-]+)/
  const match = logEvent.message.match(summaryPattern)
  if (match) {
    functionRequestId = match[1]
  } else {
    const noSummaryPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s+([a-fA-F0-9-]+)/
    const match = logEvent.message.match(noSummaryPattern)
    if (match) {
      functionRequestId = match[1]
    }
  }
  if (functionRequestId === "") {
    // could not get function request id so just log message as a string
    eventMessage = logEvent.message
  } else {
    eventMessage = {
      message: logEvent.message,
      function_request_id: functionRequestId
    }
  }
  return eventMessage
}

function transformLogEvent(logEvent, logGroup, accountNumber) {
  // Try and parse message as JSON
  let eventMessage = ""
  try {
    eventMessage = JSON.parse(logEvent.message)
  } catch (_) {
    /*
    if its a lambda log that we could not parse to json object
    then we want to try and extract the function_request_id to easier search and link in splunk
    possible messages are
    REPORT RequestId: ff7fe271-9934-4688-b9f9-f2c0cd9857cd	....
    END RequestId: ff7fe271-9934-4688-b9f9-f2c0cd9857cd ...
    START RequestId: ff7fe271-9934-4688-b9f9-f2c0cd9857cd ...
    2023-08-22T09:52:29.585Z 720f4d20-ffd3-4a06-924a-0a61c9c594c8 <message>
    */
    if (logGroup.startsWith("/aws/lambda/")) {
      eventMessage = transformLambdaLogEvent(logEvent)
    } else {
      // not a lambda log and can not parse as json so just log message as a string
      eventMessage = logEvent.message
    }
  }

  const event = {
    time: logEvent.timestamp,
    host: "AWS:AccountNumber:" + accountNumber,
    source: "AWS:LogGroup:" + logGroup,
    sourcetype: SPLUNK_SOURCE_TYPE,
    event: {
      id: logEvent.id,
      message: eventMessage
    }
  }
  return Promise.resolve(JSON.stringify(event))
}

function createReingestionRecord(isSas, originalRecord) {
  if (isSas) {
    return {
      Data: Buffer.from(originalRecord.data, "base64"),
      PartitionKey: originalRecord.kinesisRecordMetadata.partitionKey
    }
  } else {
    return {
      Data: Buffer.from(originalRecord.data, "base64")
    }
  }
}

function getReingestionRecord(isSas, reIngestionRecord) {
  if (isSas) {
    return {
      Data: reIngestionRecord.Data,
      PartitionKey: reIngestionRecord.PartitionKey
    }
  } else {
    return {
      Data: reIngestionRecord.Data
    }
  }
}

function batchRecordsToReingest(records, event, result, isSas, inputDataByRecId) {
  let totalRecordsToBeReingested = 0
  let recordsToReingest = []
  const putRecordBatches = []

  let projectedSize = records
    .filter((rec) => rec.result === "Ok")
    .map((r) => r.recordId.length + r.data.length)
    .reduce((a, b) => a + b, 0)
  // 6000000 instead of 6291456 to leave ample headroom for the stuff we didn't account for
  for (let idx = 0; idx < event.records.length && projectedSize > 6000000; idx++) {
    const rec = result.records[idx]
    if (rec.result === "Ok") {
      totalRecordsToBeReingested++
      recordsToReingest.push(getReingestionRecord(isSas, inputDataByRecId[rec.recordId]))
      projectedSize -= rec.data.length
      delete rec.data
      result.records[idx].result = "Dropped"

      // split out the record batches into multiple groups, 500 records at max per group
      if (recordsToReingest.length === 500) {
        putRecordBatches.push(recordsToReingest)
        recordsToReingest = []
      }
    }
  }

  if (recordsToReingest.length > 0) {
    // add the last batch
    putRecordBatches.push(recordsToReingest)
  }

  return [putRecordBatches, totalRecordsToBeReingested]
}

function reingestRecordBatches(putRecordBatches, isSas, totalRecordsToBeReingested, event, callback, result) {
  const streamARN = isSas ? event.sourceKinesisStreamArn : event.deliveryStreamArn
  const region = streamARN.split(":")[3]
  const streamName = streamARN.split("/")[1]

  new Promise((resolve, reject) => {
    let recordsReingestedSoFar = 0
    for (const recordBatch of putRecordBatches) {
      if (isSas) {
        const client = new Kinesis({region: region})
        helpers.putRecordsToKinesisStream(streamName, recordBatch, client, resolve, reject, 0, 20, logger)
      } else {
        const client = new Firehose({region: region})
        helpers.putRecordsToFirehoseStream(streamName, recordBatch, client, resolve, reject, 0, 20, logger)
      }
      recordsReingestedSoFar += recordBatch.length
      logger.info("Reingesting records...", {
        totalRecordsReingested: recordsReingestedSoFar,
        totalRecordsToBeReingested: totalRecordsToBeReingested,
        totalRecords: event.records.length,
        stream: streamName
      })
    }
  }).then(
    () => {
      logger.info("Reingesting records complete.", {
        totalRecordsToBeReingested: totalRecordsToBeReingested,
        totalRecords: event.records.length,
        stream: streamName
      })
      callback(null, result)
    },
    (failed) => {
      logger.info("Failed to reingest records", {failed})
      callback(failed, null)
    }
  )
}

exports.handler = (event, context, callback) => {
  logger.addContext(context)
  logger.info("Processor received event", {event: event, env: ENV})
  Promise.all(
    event.records.map((r) => {
      const buffer = Buffer.from(r.data, "base64")

      let decompressed
      try {
        decompressed = zlib.gunzipSync(buffer)
      } catch (e) {
        logger.warn("Failed to decompress record", {record: {r}, error: e})
        return Promise.resolve({
          recordId: r.recordId,
          result: "ProcessingFailed"
        })
      }

      const data = JSON.parse(decompressed)

      // CONTROL_MESSAGE are sent by CWL to check if the subscription is reachable.
      // They do not contain actual data.
      if (data.messageType === "CONTROL_MESSAGE") {
        return Promise.resolve({
          recordId: r.recordId,
          result: "Dropped"
        })
      }
      if (data.messageType === "DATA_MESSAGE") {
        const logGroup = data.logGroup
        const accountNumber = data.owner
        if (logGroup && accountNumber) {
          const promises = data.logEvents.map((logEvent) => transformLogEvent(logEvent, logGroup, accountNumber))
          return Promise.all(promises).then((transformed) => {
            const payload = transformed.reduce((a, v) => a + v, "")
            const encoded = Buffer.from(payload).toString("base64")
            return {
              recordId: r.recordId,
              result: "Ok",
              data: encoded
            }
          })
        }
        logger.info("Data lacking logGroup or owner", {data})
      }
      return Promise.resolve({
        recordId: r.recordId,
        result: "ProcessingFailed"
      })
    })
  )
    .then((records) => {
      const isSas = Object.hasOwn(event, "sourceKinesisStreamArn")
      const result = {records: records}

      const inputDataByRecId = {}
      event.records.forEach((r) => (inputDataByRecId[r.recordId] = createReingestionRecord(isSas, r)))

      const [putRecordBatches, totalRecordsToBeReingested] = batchRecordsToReingest(
        records,
        event,
        result,
        isSas,
        inputDataByRecId
      )

      if (putRecordBatches.length > 0) {
        reingestRecordBatches(putRecordBatches, isSas, totalRecordsToBeReingested, event, callback, result)
      } else {
        logger.info("No records need to be reingested.", {transformation_result: result})
        callback(null, result)
      }
    })
    .catch((ex) => {
      logger.error("Error", {ex})
      callback(ex, null)
    })
}

exports.transformLogEvent = transformLogEvent
exports.createReingestionRecord = createReingestionRecord
exports.getReingestionRecord = getReingestionRecord
exports.batchRecordsToReingest = batchRecordsToReingest
exports.reingestRecordBatches = reingestRecordBatches
