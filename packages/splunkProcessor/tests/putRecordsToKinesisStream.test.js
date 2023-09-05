const {putRecordsToKinesisStream} = require("../src/splunkProcessor.js")
const {expect, describe, it} = require("@jest/globals")
const {Kinesis} = require("@aws-sdk/client-kinesis")

jest.mock("@aws-sdk/client-kinesis")

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

    putRecordsToKinesisStream(streamName, records, client, resolve, reject, 0, 3)

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

    // Mock the response with an error from AWS Kinesis
    client.putRecords.mockImplementation((params, callback) => {
      callback(new Error("Simulated error"), null) // Simulate an error
    })

    putRecordsToKinesisStream(streamName, records, client, resolve, reject, 0, 3)

    expect(client.putRecords).toHaveBeenCalledTimes(3) // Max attempts reached
    expect(resolve).not.toHaveBeenCalled()
    expect(reject).toHaveBeenCalledWith("Could not put records after 3 attempts. Error: Simulated error")
  })
})
