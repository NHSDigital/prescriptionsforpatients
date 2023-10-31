const {putRecordsToKinesisStream} = require("../src/helpers.js")
const {expect, describe, it} = require("@jest/globals")
const {Kinesis} = require("@aws-sdk/client-kinesis")
const {Logger} = require("@aws-lambda-powertools/logger")

jest.mock("@aws-sdk/client-kinesis")

const logger = new Logger({serviceName: "splunkProcessor", logLevel: "INFO"})

describe("putRecordsToKinesisStream", () => {
  it("should resolve when all records are successfully sent", async () => {
    const streamName = "test-stream"
    const records = [{Data: "Record1"}, {Data: "Record2"}]
    const client = new Kinesis()
    const resolve = jest.fn()
    const reject = jest.fn()

    // Mock the successful response from AWS Kinesis
    client.putRecords.mockImplementationOnce((params, callback) => {
      callback(null, {Records: [{}, {}]}) // Simulate successful response
    })

    putRecordsToKinesisStream(streamName, records, client, resolve, reject, 0, 3, logger)

    expect(client.putRecords).toHaveBeenCalledWith(
      {
        StreamName: streamName,
        Records: records
      },
      expect.any(Function)
    )
    expect(resolve).toHaveBeenCalledWith("")
    expect(reject).not.toHaveBeenCalled()
  })

  it("should reject after reaching max attempts if some records fail", async () => {
    const streamName = "test-stream"
    const records = [{Data: "Record1"}, {Data: "Record2"}]
    const client = new Kinesis()
    const resolve = jest.fn()
    const reject = jest.fn()
    const logger = new Logger({})

    // Mock the response with an error from AWS Kinesis
    client.putRecords.mockImplementation((params, callback) => {
      callback(new Error("Simulated error"), null) // Simulate an error
    })

    putRecordsToKinesisStream(streamName, records, client, resolve, reject, 0, 3, logger)

    expect(client.putRecords).toHaveBeenCalledTimes(3) // Max attempts reached
    expect(resolve).not.toHaveBeenCalled()
    expect(reject).toHaveBeenCalledWith("Could not put records after 3 attempts. Error: Simulated error")
  })
})
