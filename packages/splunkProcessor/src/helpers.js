function putRecordsToFirehoseStream(streamName, records, client, resolve, reject, attemptsMade, maxAttempts, logger) {
  client.putRecordBatch(
    {
      DeliveryStreamName: streamName,
      Records: records
    },
    (err, data) => {
      const codes = []
      let failed = []
      let errMsg = err

      if (err) {
        failed = records
      } else {
        for (let i = 0; i < data.RequestResponses.length; i++) {
          const code = data.RequestResponses[i].ErrorCode
          if (code) {
            codes.push(code)
            failed.push(records[i])
          }
        }
        errMsg = `Individual error codes: ${codes}`
      }

      if (failed.length > 0) {
        if (attemptsMade + 1 < maxAttempts) {
          logger.info("Some records failed while calling PutRecordBatch, retrying.", {error: errMsg})
          putRecordsToFirehoseStream(streamName, failed, client, resolve, reject, attemptsMade + 1, maxAttempts)
        } else {
          reject(`Could not put records after ${maxAttempts} attempts. ${errMsg}`)
        }
      } else {
        resolve("")
      }
    }
  )
}

function putRecordsToKinesisStream(streamName, records, client, resolve, reject, attemptsMade, maxAttempts, logger) {
  client.putRecords(
    {
      StreamName: streamName,
      Records: records
    },
    (err, data) => {
      const codes = []
      let failed = []
      let errMsg = err

      if (err) {
        failed = records
      } else {
        for (let i = 0; i < data.Records.length; i++) {
          const code = data.Records[i].ErrorCode
          if (code) {
            codes.push(code)
            failed.push(records[i])
          }
        }
        errMsg = `Individual error codes: ${codes}`
      }

      if (failed.length > 0) {
        if (attemptsMade + 1 < maxAttempts) {
          logger.info("Some records failed while calling PutRecords, retrying.", {error: errMsg})
          putRecordsToKinesisStream(streamName, failed, client, resolve, reject, attemptsMade + 1, maxAttempts)
        } else {
          reject(`Could not put records after ${maxAttempts} attempts. ${errMsg}`)
        }
      } else {
        resolve("")
      }
    }
  )
}

exports.putRecordsToFirehoseStream = putRecordsToFirehoseStream
exports.putRecordsToKinesisStream = putRecordsToKinesisStream
