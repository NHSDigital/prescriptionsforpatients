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
  noUpdateDataEventAndResponse,
  richEventAndResponse,
  simpleEventAndResponse,
  unsuccessfulEventAndResponse
} from "./utils"
import {Bundle, MedicationRequest} from "fhir/r4"
import {lambdaHandler} from "../src/enrichPrescriptions"

describe("Unit tests for handler", function () {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(SYSTEM_DATETIME)
  })

  it("when event contains a bundle with one prescription, one MedicationRequest and status updates, updates are applied", async () => {
    const {event, expectedResponse} = simpleEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when event contains a bundle with multiple prescriptions, multiple MedicationRequests and status updates, updates are applied", async () => {
    const {event, expectedResponse} = richEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when no prescriptions in status update data, the default update is applied", async () => {
    const {event, expectedResponse} = simpleEventAndResponse()

    event.StatusUpdates!.Payload.prescriptions = []

    const searchSetBundle = expectedResponse.body as Bundle
    const collectionBundle = searchSetBundle.entry![0].resource! as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension()

    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when status update data is flagged as unsuccessful, no updates are applied", async () => {
    const {event, expectedResponse} = unsuccessfulEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when no status update data, no updates are applied", async () => {
    const {event, expectedResponse} = noUpdateDataEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })
})
