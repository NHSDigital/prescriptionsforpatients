const {getReingestionRecord} = require("../src/splunkProcessor.js")
const {expect, describe, it} = require("@jest/globals")

describe("getReingestionRecord", () => {
  // Test case 1: Check if the function correctly returns a reingestion record with SAS
  it("should return a reingestion record with SAS", () => {
    const reIngestionRecord = {
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64"), // "Hello World" in base64
      PartitionKey: "12345"
    }

    const isSas = true
    const result = getReingestionRecord(isSas, reIngestionRecord)

    expect(result).toEqual({
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64"),
      PartitionKey: "12345"
    })
  })

  // Test case 2: Check if the function correctly returns a reingestion record without SAS
  it("should return a reingestion record without SAS", () => {
    const reIngestionRecord = {
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64") // "Hello World" in base64
    }

    const isSas = false
    const result = getReingestionRecord(isSas, reIngestionRecord)

    expect(result).toEqual({
      Data: Buffer.from("SGVsbG8gV29ybGQ=", "base64")
    })
  })
})
