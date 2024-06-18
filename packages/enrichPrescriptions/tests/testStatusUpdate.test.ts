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
  simpleResponseBundle,
  simpleStatusUpdatesPayload,
  addExtensionToMedicationRequest,
  getStatusExtensions,
  simpleUpdateWithStatus
} from "./utils"
import {
  ONE_WEEK_IN_MS,
  StatusUpdates,
  applyStatusUpdates,
  delayWithPharmacyStatus,
  getStatusDate
} from "../src/statusUpdates"
import {Bundle, MedicationRequest} from "fhir/r4"
import {Logger} from "@aws-lambda-powertools/logger"

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
    statusUpdates.prescriptions.forEach((p) => (p.onboarded = false))

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

  it("when an update has a terminal state flag set to true, but is less than seven days old, the status is set as 'active'", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()
    statusUpdates.prescriptions[0].items[0].isTerminalState = "true"

    const underOneWeek = ONE_WEEK_IN_MS - 1000
    const lessThanOneWeekAgo = new Date(SYSTEM_DATETIME.valueOf() - underOneWeek).toISOString()
    statusUpdates.prescriptions[0].items[0].lastUpdateDateTime = lessThanOneWeekAgo

    const expected = simpleResponseBundle()
    const collectionBundle = expected.entry![0].resource as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest

    medicationRequest.extension![0].extension![1].valueDateTime = lessThanOneWeekAgo

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expected)
  })

  it("when an update has a terminal state flag set to true, and is over seven days old, the status is set as 'complete'", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()
    statusUpdates.prescriptions[0].items[0].isTerminalState = "true"

    const overOneWeek = ONE_WEEK_IN_MS + 1000
    const moreThanOneWeekAgo = new Date(SYSTEM_DATETIME.valueOf() - overOneWeek).toISOString()
    statusUpdates.prescriptions[0].items[0].lastUpdateDateTime = moreThanOneWeekAgo

    const expected = simpleResponseBundle()
    const collectionBundle = expected.entry![0].resource as Bundle
    const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest

    medicationRequest.status = "completed"
    medicationRequest.extension![0].extension![1].valueDateTime = moreThanOneWeekAgo

    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(expected)
  })

  it("when an update for an item is present and extension exists, the update is added", async () => {
    const requestBundle = simpleRequestBundle()
    const statusUpdates = simpleStatusUpdatesPayload()

    const existingExtension = {
      url: "https://fhir.nhs.uk/extension",
      extension: [
        {
          url: "url",
          valueCoding: {
            system: "https://fhir.nhs.uk/CodeSystem/system"
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

  const testCases = [
    {status: "Prescriber Approved", expectedCode: "Prescriber Approved"},
    {status: "Cancelled", expectedCode: "Cancelled"}
  ]

  testCases.forEach(({status, expectedCode}) => {
    it(`when an update for an item is present with status ${status}, the update is not applied`, async () => {
      const requestBundle = simpleRequestBundle()
      const requestCollectionBundle = requestBundle.entry![0].resource as Bundle
      const medicationRequest = requestCollectionBundle.entry![0].resource as MedicationRequest

      // Add the initial extension
      addExtensionToMedicationRequest(medicationRequest, status, "2023-09-11T10:11:12.000Z")

      const statusUpdates = simpleStatusUpdatesPayload()
      applyStatusUpdates(requestBundle, statusUpdates)

      // Check that the original extension is still present and unchanged
      expect(medicationRequest.extension![0].extension![0].valueCoding!.code).toEqual(expectedCode)
      expect(medicationRequest.extension![0].extension![1].valueDateTime).toEqual("2023-09-11T10:11:12.000Z")
    })
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

  it("status history extension order does not affect update application", async () => {
    const requestBundle = simpleRequestBundle()

    // Reverse the order of the status history extensions
    const prescriptionBundle = requestBundle.entry![0].resource as Bundle
    const medicationRequest = prescriptionBundle.entry![0].resource as MedicationRequest
    medicationRequest.extension = defaultExtension(false)
    const statusHistory = medicationRequest.extension![0].extension
    statusHistory!.reverse()

    const statusUpdates = simpleStatusUpdatesPayload()
    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(simpleResponseBundle())
    expect(medicationRequest.extension![0].extension!.length).toEqual(2)
  })

  describe("Delay WithPharmacy status", () => {
    type TestCase = {
      pfpStatus: string
      pfpUpdateDelay: number
      npptUpdates: StatusUpdates | undefined
      expectedStatus: string
      expectedStatusDate: string
      expectDelayLog?: boolean
    }

    it.each<TestCase>([
      {
        pfpStatus: "With Pharmacy but Tracking not Supported",
        pfpUpdateDelay: 30,
        npptUpdates: {
          schemaVersion: 1,
          isSuccess: true,
          prescriptions: []
        },
        expectedStatus: "Prescriber Approved",
        expectedStatusDate: SYSTEM_DATETIME.toISOString(),
        expectDelayLog: true
      },
      {
        pfpStatus: "With Pharmacy but Tracking not Supported",
        pfpUpdateDelay: 30,
        npptUpdates: simpleUpdateWithStatus("With Pharmacy"),
        expectedStatus: "With Pharmacy",
        expectedStatusDate: "2023-09-11T10:11:12.000Z"
      },
      {
        pfpStatus: "With Pharmacy but Tracking not Supported",
        pfpUpdateDelay: 30,
        npptUpdates: simpleStatusUpdatesPayload(),
        expectedStatus: "Ready to Collect",
        expectedStatusDate: "2023-09-11T10:11:12.000Z"
      },
      {
        pfpStatus: "With Pharmacy but Tracking not Supported",
        pfpUpdateDelay: 75,
        npptUpdates: {
          schemaVersion: 1,
          isSuccess: true,
          prescriptions: []
        },
        expectedStatus: "With Pharmacy but Tracking not Supported",
        expectedStatusDate: SYSTEM_DATETIME.toISOString()
      }
    ])(
      "when PfP returns '$pfpStatus' $pfpUpdateDelay minutes ago, and NPPT updates are $npptUpdates, set status as '$expectedStatus'",
      async ({
        pfpStatus,
        pfpUpdateDelay,
        npptUpdates,
        expectedStatus,
        expectedStatusDate,
        expectDelayLog
      }: TestCase) => {
        const mockLogger = jest.spyOn(Logger.prototype, "info")

        const requestBundle = simpleRequestBundle()
        const requestCollectionBundle = requestBundle.entry![0].resource as Bundle
        const medicationRequest = requestCollectionBundle.entry![0].resource as MedicationRequest

        const updateTime = new Date(SYSTEM_DATETIME.valueOf() - 1000 * 60 * pfpUpdateDelay).toISOString()
        addExtensionToMedicationRequest(medicationRequest, pfpStatus, updateTime)

        if (npptUpdates) {
          applyStatusUpdates(requestBundle, npptUpdates)
        }

        expect(medicationRequest.extension![0].extension![0].valueCoding!.code).toEqual(expectedStatus)
        expect(medicationRequest.extension![0].extension![1].valueDateTime).toEqual(expectedStatusDate)

        if (expectDelayLog) {
          expect(mockLogger).toHaveBeenCalledWith(
            `Delaying 'With Pharmacy but Tracking not Supported' status for prescription ${medicationRequest?.groupIdentifier?.value} line item id e76812cf-c893-42ff-ab02-b19ea1fa11b4`
          )
        }

        const statusExtensions = getStatusExtensions(medicationRequest)
        expect(statusExtensions).toHaveLength(1)
      }
    )

    it("If the status is not 'With Pharmacy but Tracking not Supported', delayWithPharmacyStatus returns false", async () => {
      const requestBundle = simpleRequestBundle()
      const requestCollectionBundle = requestBundle.entry![0].resource as Bundle
      const medicationRequest = requestCollectionBundle.entry![0].resource as MedicationRequest

      // Add the initial extension for prescription released 30 minutes ago
      const updateTime = new Date(SYSTEM_DATETIME.valueOf() - 1000 * 60 * 30).toISOString()
      addExtensionToMedicationRequest(medicationRequest, "Ready to Collect", updateTime)

      expect(delayWithPharmacyStatus(medicationRequest)).toEqual(false)
    })

    it("getting statusDate from extension can handle missing date", async () => {
      const incomplete_extension = defaultExtension()[0]
      delete incomplete_extension.extension![1].valueDateTime

      expect(getStatusDate(incomplete_extension)).toEqual(undefined)
    })
  })
})
