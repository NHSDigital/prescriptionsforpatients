const {createReingestionRecord} = require("../src/splunkProcessor.js")
const {expect, describe, it} = require("@jest/globals")

describe("createReingestionRecord", () => {
  // Test case 1: Check if the function correctly creates a reingestion record with SAS
  it("should create a reingestion record with SAS", () => {
    const originalRecord = {
      data: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
      kinesisRecordMetadata: {
        partitionKey: "12345"
      }
    }

    const isSas = true
    const result = createReingestionRecord(isSas, originalRecord)

    expect(result).toEqual({
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64"),
      PartitionKey: "12345"
    })
  })

  // Test case 2: Check if the function correctly creates a reingestion record without SAS
  it("should create a reingestion record without SAS", () => {
    const originalRecord = {
      data: "SGVsbG8gV29ybGQ=" // "Hello World" in base64
    }

    const isSas = false
    const result = createReingestionRecord(isSas, originalRecord)

    expect(result).toEqual({
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64")
    })
  })
})
