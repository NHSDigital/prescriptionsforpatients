const {putRecordsToFirehoseStream} = require("../src/splunkProcessor.js")
const {expect, describe, it} = require("@jest/globals")
const {Firehose} = require("@aws-sdk/client-firehose")

jest.mock("@aws-sdk/client-firehose")

describe("putRecordsToFirehoseStream", () => {
  it("should resolve when all records are successfully sent", async () => {
    const streamName = "test-stream"
    const records = [{Data: "Record1"}, {Data: "Record2"}]
    const client = new Firehose()
    const resolve = jest.fn()
    const reject = jest.fn()

    // Mock the successful response from AWS Firehose
    client.putRecordBatch.mockImplementationOnce((params, callback) => {
      callback(null, {RequestResponses: [{}]}) // Simulate successful response
    })

    putRecordsToFirehoseStream(streamName, records, client, resolve, reject, 0, 3)

    expect(client.putRecordBatch).toHaveBeenCalledWith(
      {
        DeliveryStreamName: streamName,
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
    const client = new Firehose()
    const resolve = jest.fn()
    const reject = jest.fn()

    // Mock the response with an error from AWS Firehose
    client.putRecordBatch.mockImplementation((params, callback) => {
      callback(new Error("Simulated error"), null) // Simulate an error
    })

    putRecordsToFirehoseStream(streamName, records, client, resolve, reject, 0, 3)

    expect(client.putRecordBatch).toHaveBeenCalledTimes(3) // Max attempts reached
    expect(resolve).not.toHaveBeenCalled()
    expect(reject).toHaveBeenCalledWith("Could not put records after 3 attempts. Error: Simulated error")
  })
})
