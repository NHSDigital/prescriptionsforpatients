/* eslint-disable max-len, @typescript-eslint/consistent-type-assertions */

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

  it("when an update has a terminal state flag set to true, latestStatus is Collected, and is over seven days old, the status is set as 'completed'", async () => {
    const SYSTEM_DATETIME = new Date("2024-07-01T12:21:00+00:00")
    jest.useFakeTimers().setSystemTime(SYSTEM_DATETIME)

    const requestBundle = {
      resourceType: "Bundle",
      id: "f64c85c6-ac23-4399-a104-46c9ae82ff7b",
      meta: {
        lastUpdated: "2024-07-01T09:11:16+00:00"
      },
      type: "searchset",
      total: 1,
      entry: [
        {
          fullUrl: "urn:uuid:6ecf7ef1-7895-4a13-bf57-2a598cccd510",
          search: {
            mode: "match"
          },
          resource: {
            resourceType: "Bundle",
            type: "collection",
            entry: [
              {
                fullUrl: "urn:uuid:df59b6c8-e0e2-4ae8-9463-ebe3ad33bbc1",
                resource: {
                  id: "df59b6c8-e0e2-4ae8-9463-ebe3ad33bbc1",
                  extension: [
                    {
                      extension: [
                        {
                          url: "statusDate",
                          valueDateTime: "2024-06-28T12:21:00+00:00"
                        },
                        {
                          url: "status",
                          valueCoding: {
                            code: "With Pharmacy but Tracking not Supported",
                            system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"
                          }
                        }
                      ],
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
                    }
                  ],
                  courseOfTherapyType: {
                    coding: [
                      {
                        code: "acute",
                        display: "Short course (acute) therapy",
                        system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy"
                      }
                    ]
                  },
                  dispenseRequest: {
                    performer: {
                      reference: "urn:uuid:5a4f0861-20a1-4199-b2bc-908b80f06e5b"
                    },
                    quantity: {
                      code: "3318611000001103",
                      system: "https://snomed.info/sct",
                      unit: "pre-filled disposable injection",
                      value: 1
                    },
                    validityPeriod: {
                      start: "2024-06-28"
                    }
                  },
                  groupIdentifier: {
                    system: "https://fhir.nhs.uk/Id/prescription-order-number",
                    value: "6BA827-A83008-913B1N"
                  },
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                      value: "40F64D6B-A344-4374-9E36-EABAA1E4E4DE"
                    }
                  ],
                  intent: "order",
                  medicationCodeableConcept: {
                    coding: [
                      {
                        code: "15517911000001104",
                        display: "Methotrexate 10mg/0.2ml solution for injection pre-filled syringes",
                        system: "https://snomed.info/sct"
                      }
                    ]
                  },
                  requester: {
                    reference: "urn:uuid:56060907-5d0a-474d-93a2-1cc1c9307745"
                  },
                  status: "unknown",
                  subject: {
                    identifier: {
                      system: "https://fhir.nhs.uk/Id/nhs-number",
                      value: "9563327527"
                    }
                  },
                  substitution: {
                    allowedBoolean: false
                  },
                  resourceType: "MedicationRequest"
                }
              },
              {
                fullUrl: "urn:uuid:5c3ee309-997a-41ca-90df-d48ba85094a9",
                resource: {
                  id: "5c3ee309-997a-41ca-90df-d48ba85094a9",
                  name: [
                    {
                      family: "Userq",
                      given: ["Random"],
                      prefix: ["MR"]
                    }
                  ],
                  resourceType: "Practitioner"
                }
              },
              {
                fullUrl: "urn:uuid:56060907-5d0a-474d-93a2-1cc1c9307745",
                resource: {
                  id: "56060907-5d0a-474d-93a2-1cc1c9307745",
                  organization: {
                    reference: "urn:uuid:d2d979d0-bfdb-4347-be83-d564de6b78ab"
                  },
                  practitioner: {
                    reference: "urn:uuid:5c3ee309-997a-41ca-90df-d48ba85094a9"
                  },
                  resourceType: "PractitionerRole"
                }
              },
              {
                fullUrl: "urn:uuid:d2d979d0-bfdb-4347-be83-d564de6b78ab",
                resource: {
                  id: "d2d979d0-bfdb-4347-be83-d564de6b78ab",
                  address: [
                    {
                      line: ["MUSGROVE PARK HOSPITAL", "TAUNTON"],
                      postalCode: "TA1 5DA",
                      type: "both",
                      use: "work"
                    }
                  ],
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/ods-organization-code",
                      value: "A99968"
                    }
                  ],
                  name: "SOMERSET BOWEL CANCER SCREENING CENTRE",
                  telecom: [
                    {
                      system: "phone",
                      use: "work",
                      value: "01823333444"
                    }
                  ],
                  resourceType: "Organization"
                }
              },
              {
                fullUrl: "urn:uuid:5a4f0861-20a1-4199-b2bc-908b80f06e5b",
                resource: {
                  id: "5a4f0861-20a1-4199-b2bc-908b80f06e5b",
                  address: [
                    {
                      text: "85-87 ERLEIGH ROAD, READING, BERKSHIRE, , RG1 5NN",
                      type: "both",
                      use: "work"
                    }
                  ],
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/ods-organization-code",
                      value: "FA288"
                    }
                  ],
                  name: "ERLEIGH ROAD PHARMACY",
                  telecom: [
                    {
                      system: "phone",
                      use: "work",
                      value: "0118 9663718"
                    }
                  ],
                  resourceType: "Organization"
                }
              }
            ]
          }
        }
      ]
    } as Bundle

    const statusUpdates = {
      schemaVersion: 1,
      isSuccess: true,
      prescriptions: [
        {
          prescriptionID: "6BA827-A83008-913B1N",
          onboarded: true,
          items: [
            {
              itemId: "40F64D6B-A344-4374-9E36-EABAA1E4E4DE",
              latestStatus: "Collected",
              isTerminalState: "completed",
              lastUpdateDateTime: "2024-06-10T10:11:12Z"
            }
          ]
        }
      ]
    } as StatusUpdates

    const expected = {
      resourceType: "Bundle",
      id: "f64c85c6-ac23-4399-a104-46c9ae82ff7b",
      meta: {
        lastUpdated: "2024-07-01T09:11:16+00:00"
      },
      type: "searchset",
      total: 1,
      entry: [
        {
          fullUrl: "urn:uuid:6ecf7ef1-7895-4a13-bf57-2a598cccd510",
          search: {
            mode: "match"
          },
          resource: {
            resourceType: "Bundle",
            type: "collection",
            entry: [
              {
                fullUrl: "urn:uuid:df59b6c8-e0e2-4ae8-9463-ebe3ad33bbc1",
                resource: {
                  id: "df59b6c8-e0e2-4ae8-9463-ebe3ad33bbc1",
                  extension: [
                    {
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
                      extension: [
                        {
                          url: "status",
                          valueCoding: {
                            system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                            code: "Collected"
                          }
                        },
                        {
                          url: "statusDate",
                          valueDateTime: "2024-06-10T10:11:12Z"
                        }
                      ]
                    }
                  ],
                  courseOfTherapyType: {
                    coding: [
                      {
                        code: "acute",
                        display: "Short course (acute) therapy",
                        system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy"
                      }
                    ]
                  },
                  dispenseRequest: {
                    performer: {
                      reference: "urn:uuid:5a4f0861-20a1-4199-b2bc-908b80f06e5b"
                    },
                    quantity: {
                      code: "3318611000001103",
                      system: "https://snomed.info/sct",
                      unit: "pre-filled disposable injection",
                      value: 1
                    },
                    validityPeriod: {
                      start: "2024-06-28"
                    }
                  },
                  groupIdentifier: {
                    system: "https://fhir.nhs.uk/Id/prescription-order-number",
                    value: "6BA827-A83008-913B1N"
                  },
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                      value: "40F64D6B-A344-4374-9E36-EABAA1E4E4DE"
                    }
                  ],
                  intent: "order",
                  medicationCodeableConcept: {
                    coding: [
                      {
                        code: "15517911000001104",
                        display: "Methotrexate 10mg/0.2ml solution for injection pre-filled syringes",
                        system: "https://snomed.info/sct"
                      }
                    ]
                  },
                  requester: {
                    reference: "urn:uuid:56060907-5d0a-474d-93a2-1cc1c9307745"
                  },
                  status: "completed",
                  subject: {
                    identifier: {
                      system: "https://fhir.nhs.uk/Id/nhs-number",
                      value: "9563327527"
                    }
                  },
                  substitution: {
                    allowedBoolean: false
                  },
                  resourceType: "MedicationRequest"
                }
              },
              {
                fullUrl: "urn:uuid:5c3ee309-997a-41ca-90df-d48ba85094a9",
                resource: {
                  id: "5c3ee309-997a-41ca-90df-d48ba85094a9",
                  name: [
                    {
                      family: "Userq",
                      given: ["Random"],
                      prefix: ["MR"]
                    }
                  ],
                  resourceType: "Practitioner"
                }
              },
              {
                fullUrl: "urn:uuid:56060907-5d0a-474d-93a2-1cc1c9307745",
                resource: {
                  id: "56060907-5d0a-474d-93a2-1cc1c9307745",
                  organization: {
                    reference: "urn:uuid:d2d979d0-bfdb-4347-be83-d564de6b78ab"
                  },
                  practitioner: {
                    reference: "urn:uuid:5c3ee309-997a-41ca-90df-d48ba85094a9"
                  },
                  resourceType: "PractitionerRole"
                }
              },
              {
                fullUrl: "urn:uuid:d2d979d0-bfdb-4347-be83-d564de6b78ab",
                resource: {
                  id: "d2d979d0-bfdb-4347-be83-d564de6b78ab",
                  address: [
                    {
                      line: ["MUSGROVE PARK HOSPITAL", "TAUNTON"],
                      postalCode: "TA1 5DA",
                      type: "both",
                      use: "work"
                    }
                  ],
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/ods-organization-code",
                      value: "A99968"
                    }
                  ],
                  name: "SOMERSET BOWEL CANCER SCREENING CENTRE",
                  telecom: [
                    {
                      system: "phone",
                      use: "work",
                      value: "01823333444"
                    }
                  ],
                  resourceType: "Organization"
                }
              },
              {
                fullUrl: "urn:uuid:5a4f0861-20a1-4199-b2bc-908b80f06e5b",
                resource: {
                  id: "5a4f0861-20a1-4199-b2bc-908b80f06e5b",
                  address: [
                    {
                      text: "85-87 ERLEIGH ROAD, READING, BERKSHIRE, , RG1 5NN",
                      type: "both",
                      use: "work"
                    }
                  ],
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/ods-organization-code",
                      value: "FA288"
                    }
                  ],
                  name: "ERLEIGH ROAD PHARMACY",
                  telecom: [
                    {
                      system: "phone",
                      use: "work",
                      value: "0118 9663718"
                    }
                  ],
                  resourceType: "Organization"
                }
              }
            ]
          }
        }
      ]
    } as Bundle

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
})
