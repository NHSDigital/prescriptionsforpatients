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
  getStatusUpdatesFailedEventAndResponse,
  noUpdateDataEventAndResponse,
  richEventAndResponse,
  simpleEventAndResponse
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

  it("when no prescriptions in status update data, the not-onboarded update is applied", async () => {
    const {event, expectedResponse} = simpleEventAndResponse()

    event.StatusUpdates!.Payload.prescriptions = []

    const searchSetBundle = JSON.parse(expectedResponse.body) as Bundle
    const collectionBundle = searchSetBundle.entry![0].resource! as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension(false)
    expectedResponse.body = JSON.stringify(searchSetBundle)

    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when no status update data (call to GetStatusUpdates toggled-off), no updates are applied", async () => {
    const {event, expectedResponse} = noUpdateDataEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })

  it("when status update is unsuccessful (call to GetStatusUpdates fails), temporary updates are applied", async () => {
    const {event, expectedResponse} = getStatusUpdatesFailedEventAndResponse()
    const actualResponse = await lambdaHandler(event)

    expect(actualResponse).toEqual(expectedResponse)
  })
})
