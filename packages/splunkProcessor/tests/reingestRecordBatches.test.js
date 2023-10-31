const splunkProcessor = require("../src/splunkProcessor.js")
const helpers = require("../src/helpers.js")

const {expect, describe, it} = require("@jest/globals")
const {Firehose} = require("@aws-sdk/client-firehose")
const {Kinesis} = require("@aws-sdk/client-kinesis")
const {Logger} = require("@aws-lambda-powertools/logger")

jest.mock("@aws-sdk/client-kinesis")
jest.mock("@aws-sdk/client-firehose")

describe("reingestRecordBatches", () => {
  beforeEach(() => {
    // Mock the putRecordsToKinesisStream and putRecordsToFirehoseStream functions
    jest
      .spyOn(helpers, "putRecordsToKinesisStream")
      // eslint-disable-next-line no-unused-vars
      .mockImplementation((streamName, records, client, resolve, reject, attemptsMade, maxAttempts, logger) => {
        resolve("")
      })
    jest
      .spyOn(helpers, "putRecordsToFirehoseStream")
      // eslint-disable-next-line no-unused-vars
      .mockImplementation((streamName, records, client, resolve, reject, attemptsMade, maxAttempts, logger) => {
        resolve("")
      })
    process.env.ENV = "test"
  })
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should reingest records to Kinesis when isSas is true", (done) => {
    const putRecordBatches = [{records: ["record1", "record2"]}]
    const isSas = true
    const totalRecordsToBeReingested = 2
    const event = {
      sourceKinesisStreamArn: "arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream",
      records: putRecordBatches
    }

    const callback = (error, result) => {
      expect(error).toBe(null)
      expect(result).toBe("Success")
      done()
    }
    const result = "Success"

    splunkProcessor.reingestRecordBatches(putRecordBatches, isSas, totalRecordsToBeReingested, event, callback, result)
    expect(Kinesis).toHaveBeenCalledWith({region: "us-east-1"})
    expect(helpers.putRecordsToKinesisStream).toHaveBeenCalledWith(
      "my-kinesis-stream",
      putRecordBatches[0],
      expect.any(Kinesis),
      expect.any(Function),
      expect.any(Function),
      0,
      20,
      expect.any(Logger)
    )
  })

  it("should reingest records to Firehose when isSas is false", (done) => {
    const putRecordBatches = [{records: ["record1", "record2"]}]
    const isSas = false
    const totalRecordsToBeReingested = 2
    const event = {
      deliveryStreamArn: "arn:aws:firehose:us-east-1:123456789012:deliverystream/my-firehose-stream",
      records: putRecordBatches
    }
    const callback = (error, result) => {
      expect(error).toBe(null)
      expect(result).toBe("Success")
      done()
    }
    const result = "Success"

    splunkProcessor.reingestRecordBatches(putRecordBatches, isSas, totalRecordsToBeReingested, event, callback, result)

    expect(Firehose).toHaveBeenCalledWith({region: "us-east-1"})
    expect(helpers.putRecordsToFirehoseStream).toHaveBeenCalledWith(
      "my-firehose-stream",
      putRecordBatches[0],
      expect.any(Firehose),
      expect.any(Function),
      expect.any(Function),
      0,
      20,
      expect.any(Logger)
    )
  })

  it("should handle failure", (done) => {
    const putRecordBatches = [{records: ["record1", "record2"]}]
    const isSas = true
    const totalRecordsToBeReingested = 2
    const event = {
      sourceKinesisStreamArn: "arn:aws:kinesis:us-east-1:123456789012:stream/my-kinesis-stream",
      records: putRecordBatches
    }
    const callback = (error, result) => {
      expect(error).toBe("Some error")
      expect(result).toBe(null)
      done()
    }

    // Mock a rejected promise for putRecordsToKinesisStream
    jest
      .spyOn(helpers, "putRecordsToKinesisStream")
      // eslint-disable-next-line no-unused-vars
      .mockImplementation((streamName, records, client, resolve, reject, attemptsMade, maxAttempts) => {
        reject("Some error")
      })

    splunkProcessor.reingestRecordBatches(putRecordBatches, isSas, totalRecordsToBeReingested, event, callback)
  })
})
