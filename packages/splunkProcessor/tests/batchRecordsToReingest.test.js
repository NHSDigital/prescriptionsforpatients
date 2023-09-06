const {batchRecordsToReingest} = require("../src/splunkProcessor.js")
const {expect, describe, it} = require("@jest/globals")

describe("batchRecordsToReingest", () => {
  it("should not send records for reingestion when batch is small", () => {
    // Define sample input data and event
    const records = [
      {result: "Ok", recordId: "1", data: "Data1"},
      {result: "Ok", recordId: "2", data: "Data2"}
      // Add more sample records as needed
    ]

    const event = {
      records: records
    }

    const result = {
      records: records.map((rec) => ({...rec}))
    }

    const isSas = true

    const inputDataByRecId = {
      1: {Data: Buffer.from("Data1", "utf-8"), PartitionKey: "PartitionKey1"},
      2: {Data: Buffer.from("Data2", "utf-8"), PartitionKey: "PartitionKey2"}
      // Map recordIds to input data
    }

    // Call the function
    const [putRecordBatches, totalRecordsToBeReingested] = batchRecordsToReingest(
      records,
      event,
      result,
      isSas,
      inputDataByRecId
    )

    // Perform assertions
    expect(putRecordBatches.length).toBe(0) // No batches should be created
    expect(totalRecordsToBeReingested).toBe(0) // Total reingested records should be 0
  })

  it("should send records for reingestion when batch is large", () => {
    // Define sample input data and event
    const records = []
    const inputDataByRecId = {}

    for (let i = 0; i < 389000; i++) {
      const insert_record = {result: "Ok", recordId: `${i}`, data: `Data${i}`}
      records.push(insert_record)
      inputDataByRecId[i] = {Data: Buffer.from(`Data${i}`, "utf-8")}
    }

    const event = {
      records: records
    }

    const result = {
      records: records.map((rec) => ({...rec}))
    }

    const isSas = false

    // Call the function
    const [putRecordBatches, totalRecordsToBeReingested] = batchRecordsToReingest(
      records,
      event,
      result,
      isSas,
      inputDataByRecId
    )

    // Perform assertions
    expect(putRecordBatches.length).toBe(1) // One batch should be created
    expect(totalRecordsToBeReingested).toBe(270) // Total reingested records should be 270
  })
})
