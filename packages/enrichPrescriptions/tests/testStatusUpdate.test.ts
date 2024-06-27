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
  simpleUpdateWithStatus,
  OUTER_EXTENSION_URL
} from "./utils"
import {
  APPROVED_STATUS,
  CANCELLED_STATUS,
  NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS,
  ONE_WEEK_IN_MS,
  StatusUpdates,
  TEMPORARILY_UNAVAILABLE_STATUS,
  applyStatusUpdates,
  applyTemporaryStatusUpdates,
  delayWithPharmacyStatus,
  getStatusDate
} from "../src/statusUpdates"
import {Bundle, MedicationRequest} from "fhir/r4"
import {Logger} from "@aws-lambda-powertools/logger"
import {isolateMedicationRequests, isolatePrescriptions} from "../src/fhirUtils"

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
    const statusHistory = medicationRequest.extension[0].extension
    statusHistory!.reverse()

    const statusUpdates = simpleStatusUpdatesPayload()
    applyStatusUpdates(requestBundle, statusUpdates)

    expect(requestBundle).toEqual(simpleResponseBundle())
    expect(medicationRequest.extension[0].extension!.length).toEqual(2)
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

  describe("Temporary status updates", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(SYSTEM_DATETIME)
    })

    it("Item with no status, that expects an update, is given the temporary update and has its status set as active", async () => {
      const requestBundle = simpleRequestBundle()
      const prescriptions = isolatePrescriptions(requestBundle)
      const medicationRequests = isolateMedicationRequests(prescriptions[0])
      const medicationRequest = medicationRequests![0]

      const prescriptionID = medicationRequest.groupIdentifier!.value!.toUpperCase()
      const statusUpdateData = {odsCode: "FLM49", prescriptionID: prescriptionID}

      applyTemporaryStatusUpdates(requestBundle, [statusUpdateData])
      const statusExtension = medicationRequest.extension![0].extension!.filter((e) => e.url === "status")[0]

      expect(statusExtension.valueCoding!.code!).toEqual(TEMPORARILY_UNAVAILABLE_STATUS)
      expect(medicationRequest.status).toEqual("active")
    })

    it("No temporary update if ods code or prescription ID doesn't match", async () => {
      const requestBundle = simpleRequestBundle()
      const prescriptions = isolatePrescriptions(requestBundle)
      const medicationRequests = isolateMedicationRequests(prescriptions[0])
      const medicationRequest = medicationRequests![0]

      const prescriptionID = medicationRequest.groupIdentifier!.value!.toUpperCase()
      const statusUpdateData = [
        {odsCode: "NOPE", prescriptionID: prescriptionID},
        {odsCode: "FLM49", prescriptionID: "NOPE"}
      ]

      applyTemporaryStatusUpdates(requestBundle, statusUpdateData)
      expect(medicationRequest.extension).toBeUndefined()
    })

    it.each([
      {status: "Prescriber Approved", shouldUpdate: false},
      {status: "Prescriber Cancelled", shouldUpdate: false},
      {status: "With Pharmacy but Tracking not Supported", shouldUpdate: true}
    ])(
      "Item with existing status, that expects an update, is given the temporary update when its existing status is appropriate",
      async ({status, shouldUpdate}) => {
        const requestBundle = simpleRequestBundle()
        const prescriptions = isolatePrescriptions(requestBundle)
        const medicationRequests = isolateMedicationRequests(prescriptions[0])
        const medicationRequest = medicationRequests![0]

        const updateTime = new Date().toISOString()
        addExtensionToMedicationRequest(medicationRequest, status, updateTime)

        const prescriptionID = medicationRequests![0].groupIdentifier!.value!.toUpperCase()
        const statusUpdateData = {odsCode: "FLM49", prescriptionID: prescriptionID}

        applyTemporaryStatusUpdates(requestBundle, [statusUpdateData])
        const statusExtension = medicationRequest.extension![0].extension!.filter((e) => e.url === "status")[0]!

        expect(statusExtension.valueCoding!.code!).toEqual(shouldUpdate ? TEMPORARILY_UNAVAILABLE_STATUS : status)
      }
    )
  })

  it("Prescriptions with multiple items, that expect updates, have temporary updates applied to appropriate items", async () => {
    // The richRequestBundle gives us three prescriptions with a total of six items
    const requestBundle = richRequestBundle()
    const prescriptions = isolatePrescriptions(requestBundle)

    // We modify one prescription here. One other will get the temporary update without being modified,
    // and the remaining one will not get the temporary update
    const prescriptionToBeModified = prescriptions[0]

    const medicationRequests = isolateMedicationRequests(prescriptionToBeModified)
    const updateTime = new Date().toISOString()

    // These two items will be updated with the temporary update
    addExtensionToMedicationRequest(medicationRequests![0], NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS, updateTime)
    addExtensionToMedicationRequest(medicationRequests![1], NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS, updateTime)

    // These two items will not
    addExtensionToMedicationRequest(medicationRequests![2], APPROVED_STATUS, updateTime)
    addExtensionToMedicationRequest(medicationRequests![3], CANCELLED_STATUS, updateTime)

    // These represent the modified prescription and the one that will update without being modified
    const statusUpdateData = [
      {odsCode: "FLM49", prescriptionID: "24F5DA-A83008-7EFE6Z"},
      {odsCode: "FEW08", prescriptionID: "16B2E0-A83008-81C13H"}
    ]

    applyTemporaryStatusUpdates(requestBundle, statusUpdateData)

    const tempStatusUpdateFilter = (medicationRequest: MedicationRequest) => {
      const outerExtension = medicationRequest.extension?.filter(
        (extension) => extension.url === OUTER_EXTENSION_URL
      )[0]
      const statusExtension = outerExtension?.extension?.filter((extension) => extension.url === "status")[0]
      return statusExtension?.valueCoding!.code === TEMPORARILY_UNAVAILABLE_STATUS
    }

    // Checking just the items from the modified prescription
    const medicationRequestsWithTemporaryUpdates = medicationRequests!.filter(tempStatusUpdateFilter)
    expect(medicationRequests!.length).toEqual(4)
    expect(medicationRequestsWithTemporaryUpdates.length).toEqual(2)

    // Checking all items, which will include the single item from the unmodified prescription that we expect to get the temporary update
    const allMedicationRequests = prescriptions.flatMap((prescription) =>
      isolateMedicationRequests(prescription)
    ) as Array<MedicationRequest>
    const allMedicationRequestsWithTemporaryUpdates = allMedicationRequests.filter(tempStatusUpdateFilter)

    expect(allMedicationRequests.length).toEqual(6)
    expect(allMedicationRequestsWithTemporaryUpdates.length).toEqual(3)
  })
})
