/* eslint-disable max-len */

import {
  jest,
  expect,
  describe,
  it
} from "@jest/globals"
import {
  SYSTEM_DATETIME,
  defaultExtension,
  richEventAndResponse,
  simpleEventAndResponse
} from "./utils"
import {eventHandler} from "../src/enrichPrescriptions"
import {Bundle, MedicationRequest} from "fhir/r4"

describe("Unit tests for handler", function () {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(SYSTEM_DATETIME)
  })

  it("when event contains a bundle with one prescription, one MedicationRequest and status updates, updates are applied", async () => {
    const {event, response} = simpleEventAndResponse()
    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })

  it("when event contains a bundle with multiple prescriptions, multiple MedicationRequests and status updates, updates are applied", async () => {
    const {event, response} = richEventAndResponse()
    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })

  it("when no status update data, the default update is applied", async () => {
    const {event, response} = simpleEventAndResponse()

    event.StatusUpdates.Payload.prescriptions = []

    const searchSetBundle = response.body as Bundle
    const collectionBundle = searchSetBundle.entry![0].resource! as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension()

    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })
})
