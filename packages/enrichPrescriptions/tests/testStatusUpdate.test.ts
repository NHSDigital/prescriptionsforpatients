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
  richRequestBundle,
  richResponseBundle,
  richStatusUpdatesPayload,
  simpleRequestBundle,
  simpleRequestBundlePA,
  simpleResponseBundle,
  simpleResponseBundlePA,
  simpleStatusUpdatesPayload,
  simpleStatusUpdatesPayloadPA
} from "./utils"
import {applyStatusUpdates} from "../src/statusUpdates"
import {Bundle, MedicationRequest} from "fhir/r4"

describe("Unit tests for statusUpdate", function () {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(SYSTEM_DATETIME)
  })

  it("when no update is present for a prescription, the not-onboarded update is applied", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()
    statusUpdates.prescriptions = []

    const expectedResponseBundle = simpleRequestBundle()
    const prescription = expectedResponseBundle.entry![0].resource as Bundle
    const medicationRequest = prescription.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension(false)
    medicationRequest.status = "active"

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expectedResponseBundle)
  })

  it("when an update for a prescription is flagged as not-onboarded, the not-onboarded update is applied", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()
    statusUpdates.prescriptions.forEach(p => p.onboarded = false)

    const expectedResponseBundle = simpleRequestBundle()
    const prescription = expectedResponseBundle.entry![0].resource as Bundle
    const medicationRequest = prescription.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension(false)
    medicationRequest.status = "active"

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expectedResponseBundle)
  })

  it("when an update for an item is present, the update is applied", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(simpleResponseBundle())
  })

  it("when an update for an item is present with status Prescriber Approved or Cancelled, the update is not applied", async () => {
    const requestBundle = simpleRequestBundlePA()
    const statusUpdates = simpleStatusUpdatesPayloadPA()

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(simpleResponseBundlePA())
  })

  it("when an update for an item is present and extension exists, the update is added", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()

    const existingExtension = {
      "url": "https://fhir.nhs.uk/extension",
      "extension": [
        {
          "url": "url",
          "valueCoding": {
            "system": "https://fhir.nhs.uk/CodeSystem/system"
          }
        }
      ]
    }

    const requestCollectionBundle = requestBundle.entry![0].resource as Bundle
    const medicationRequest = requestCollectionBundle.entry![0].resource as MedicationRequest
    medicationRequest.extension = [existingExtension]

    const expectedResponseBundle = simpleResponseBundle()
    const responseCollectionBundle = expectedResponseBundle.entry![0].resource as Bundle
    const responseMedicationRequest = responseCollectionBundle.entry![0].resource as MedicationRequest
    responseMedicationRequest.extension!.push(existingExtension)
    responseMedicationRequest.extension!.reverse()

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expectedResponseBundle)
  })

  it("when a prescription has no performer, no update is applied", async () => {
    const requestBundle = simpleRequestBundle()
    const collectionBundle = requestBundle.entry![0].resource as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
    delete medicationRequest.dispenseRequest?.performer

    const statusUpdates = simpleStatusUpdatesPayload()

    const responseBundle = JSON.parse(JSON.stringify(requestBundle))

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(responseBundle)
  })

  it("when updates are present for some items in a prescription, they are applied and the other items receive the default update", async () => {
    const requestBundle = richRequestBundle()
    const statusUpdates = richStatusUpdatesPayload()
    statusUpdates.prescriptions[0].items.pop()

    const expectedResponseBundle = richResponseBundle()
    const prescription = expectedResponseBundle.entry![0].resource as Bundle
    const medicationRequest = prescription.entry![3].resource as MedicationRequest
    medicationRequest.extension = defaultExtension()

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expectedResponseBundle)
  })
})
