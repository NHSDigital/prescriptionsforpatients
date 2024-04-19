/* eslint-disable max-len */

import {Bundle} from "fhir/r4"
import {EXTENSION_URL} from "../../../src/statusUpdates"

export function richResponseBundle(): Bundle {
  return {
    resourceType: "Bundle",
    id: "test-request-id",
    meta: {
      lastUpdated: "2022-11-21T14:00:00+00:00"
    },
    type: "searchset",
    total: 2,
    entry: [
      {
        fullUrl: "urn:uuid:0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
        search: {
          mode: "match"
        },
        resource: {
          resourceType: "Bundle",
          id: "0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
          type: "collection",
          entry: [
            {
              fullUrl: "urn:uuid:b4e289db-1d7c-45fc-a3d9-e81f2114b5ee",
              resource: {
                id: "b4e289db-1d7c-45fc-a3d9-e81f2114b5ee",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "a54219b8-f741-4c47-b662-e4f8dfa49ab6"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "active",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "39732311000001104",
                      display: "Amoxicillin 250mg capsules"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "24F5DA-A83008-7EFE6Z"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2022-10-21"
                  },
                  quantity: {
                    value: 20,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  },
                  performer: {
                    reference: "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "Prescriber Approved"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:12.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:2bf8f0e0-8567-4aef-ad03-c3fbfedaf4b3",
              resource: {
                id: "2bf8f0e0-8567-4aef-ad03-c3fbfedaf4b3",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "6989b7bd-8db6-428c-a593-4022e3044c00"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "completed",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "322341003",
                      display: "Co-codamol 30mg/500mg tablets"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "24F5DA-A83008-7EFE6Z"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2022-10-21"
                  },
                  quantity: {
                    value: 20,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  },
                  performer: {
                    reference: "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "Prescriber Cancelled"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:13.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:18c20e6c-dc34-4a17-8307-5cfd7efa707b",
              resource: {
                id: "18c20e6c-dc34-4a17-8307-5cfd7efa707b",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "2868554c-5565-4d31-b92a-c5b8dab8b90a"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "active",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "321080004",
                      display: "Pseudoephedrine hydrochloride 60mg tablets"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "24F5DA-A83008-7EFE6Z"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2022-10-21"
                  },
                  quantity: {
                    value: 30,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  },
                  performer: {
                    reference: "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "With Pharmacy"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:14.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:b7b8c142-7ccb-4d0c-b0a7-25f7fa83f4b4",
              resource: {
                id: "b7b8c142-7ccb-4d0c-b0a7-25f7fa83f4b4",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "5cb17f5a-11ac-4e18-825f-6470467238b3"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "active",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "324252006",
                      display: "Azithromycin 250mg capsules"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "24F5DA-A83008-7EFE6Z"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2022-10-21"
                  },
                  quantity: {
                    value: 30,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  },
                  performer: {
                    reference: "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "With Pharmacy - Preparing Remainder"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:15.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666",
              resource: {
                resourceType: "PractitionerRole",
                id: "56166769-c1c4-4d07-afa8-132b5dfca666",
                practitioner: {
                  reference: "urn:uuid:a8c85454-f8cb-498d-9629-78e2cb5fa47a"
                },
                organization: {
                  reference: "urn:uuid:3b4b03a5-52ba-4ba6-9b82-70350aa109d8"
                }
              }
            },
            {
              fullUrl: "urn:uuid:a8c85454-f8cb-498d-9629-78e2cb5fa47a",
              resource: {
                resourceType: "Practitioner",
                id: "a8c85454-f8cb-498d-9629-78e2cb5fa47a",
                name: [
                  {
                    family: "BOIN",
                    given: [
                      "C"
                    ],
                    prefix: [
                      "DR"
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:3b4b03a5-52ba-4ba6-9b82-70350aa109d8",
              resource: {
                resourceType: "Organization",
                id: "3b4b03a5-52ba-4ba6-9b82-70350aa109d8",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "A83008"
                  }
                ],
                name: "HALLGARTH SURGERY",
                telecom: [
                  {
                    system: "phone",
                    use: "work",
                    value: "0115 9737320"
                  }
                ],
                address: [
                  {
                    use: "work",
                    type: "both",
                    line: [
                      "HALLGARTH SURGERY",
                      "CHEAPSIDE"
                    ],
                    city: "SHILDON",
                    district: "COUNTY DURHAM",
                    postalCode: "DL4 2HP"
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
              resource: {
                resourceType: "Organization",
                id: "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "FLM49"
                  }
                ],
                name: "Pharmacy2u",
                telecom: [
                  {
                    system: "phone",
                    use: "work",
                    value: "0113 2650222"
                  },
                  {
                    system: "url",
                    use: "work",
                    value: "www.pharmacy2u.co.uk"
                  }
                ],
                address: [
                  {
                    use: "work",
                    type: "both",
                    line: [
                      "Unit 4B",
                      "Victoria Road"
                    ],
                    city: "LEEDS",
                    district: "WEST YORKSHIRE",
                    postalCode: "LS14 2LA"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        fullUrl: "urn:uuid:0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
        search: {
          mode: "match"
        },
        resource: {
          resourceType: "Bundle",
          id: "0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
          type: "collection",
          entry: [
            {
              fullUrl: "urn:uuid:7f9fa7aa-a6ef-4d2e-8efc-08fb9098ce34",
              resource: {
                id: "7f9fa7aa-a6ef-4d2e-8efc-08fb9098ce34",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "ee035711-7aac-48c4-951a-62c07891d37d"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "active",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "324252006",
                      display: "Azithromycin 250mg capsules"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:815c6eb3-41f8-4f48-9e0d-2983624d4f90"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "566946-B86044-FEFEFN"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2023-03-14"
                  },
                  quantity: {
                    value: 30,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "Ready to Collect"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:16.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:815c6eb3-41f8-4f48-9e0d-2983624d4f90",
              resource: {
                resourceType: "PractitionerRole",
                id: "815c6eb3-41f8-4f48-9e0d-2983624d4f90",
                practitioner: {
                  reference: "urn:uuid:acd5b009-c78f-40f2-a48b-b38ac72de992"
                },
                organization: {
                  reference: "urn:uuid:9683c147-ddad-41d9-9858-6e585c3f04df"
                }
              }
            },
            {
              fullUrl: "urn:uuid:acd5b009-c78f-40f2-a48b-b38ac72de992",
              resource: {
                resourceType: "Practitioner",
                id: "acd5b009-c78f-40f2-a48b-b38ac72de992",
                name: [
                  {
                    family: "ROBINSON",
                    given: [
                      "C"
                    ],
                    prefix: [
                      "DR"
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:9683c147-ddad-41d9-9858-6e585c3f04df",
              resource: {
                resourceType: "Organization",
                id: "9683c147-ddad-41d9-9858-6e585c3f04df",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "B86044"
                  }
                ],
                name: "IRELAND WOOD SURGERY",
                telecom: [
                  {
                    system: "phone",
                    value: "0113 2303470"
                  }
                ],
                address: [
                  {
                    use: "work",
                    type: "both",
                    line: [
                      "IVESON APPROACH"
                    ],
                    city: "LEEDS",
                    district: "WEST YORKSHIRE",
                    postalCode: "LS16 6FR",
                    country: "ENGLAND"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        fullUrl: "urn:uuid:0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
        search: {
          mode: "match"
        },
        resource: {
          resourceType: "Bundle",
          id: "0cb82cfa-76c8-4fb2-a08e-bf0e326e5487",
          type: "collection",
          entry: [
            {
              fullUrl: "urn:uuid:26fe7442-49fc-4600-aae8-658fc7d4c955",
              resource: {
                id: "26fe7442-49fc-4600-aae8-658fc7d4c955",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                    value: "b6bf7869-9b30-436c-9260-84fc3dbf449b"
                  }
                ],
                resourceType: "MedicationRequest",
                status: "active",
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      system: "https://snomed.info/sct",
                      code: "39732311000001104",
                      display: "Amoxicillin 250mg capsules"
                    }
                  ]
                },
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "9449304130"
                  }
                },
                requester: {
                  reference: "urn:uuid:56166769-c1c4-4d07-afa8-132b5dfca666"
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "16B2E0-A83008-81C13H"
                },
                courseOfTherapyType: {
                  coding: [
                    {
                      system: "https://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
                      code: "acute",
                      display: "Short course (acute) therapy"
                    }
                  ]
                },
                dispenseRequest: {
                  validityPeriod: {
                    start: "2022-10-21"
                  },
                  quantity: {
                    value: 20,
                    unit: "tablet",
                    system: "https://snomed.info/sct",
                    code: "428673006"
                  },
                  performer: {
                    reference: "urn:uuid:154dcc4a-0006-4272-9758-9dcb8d95ce8b"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                extension: [
                  {
                    url: EXTENSION_URL,
                    extension: [
                      {
                        url: "status",
                        valueCoding: {
                          system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                          code: "Ready to Collect - Partial"
                        }
                      },
                      {
                        url: "statusDate",
                        valueDateTime: "2023-09-11T10:11:17.000Z"
                      }
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:815c6eb3-41f8-4f48-9e0d-2983624d4f90",
              resource: {
                resourceType: "PractitionerRole",
                id: "815c6eb3-41f8-4f48-9e0d-2983624d4f90",
                practitioner: {
                  reference: "urn:uuid:acd5b009-c78f-40f2-a48b-b38ac72de992"
                },
                organization: {
                  reference: "urn:uuid:9683c147-ddad-41d9-9858-6e585c3f04df"
                }
              }
            },
            {
              fullUrl: "urn:uuid:acd5b009-c78f-40f2-a48b-b38ac72de992",
              resource: {
                resourceType: "Practitioner",
                id: "acd5b009-c78f-40f2-a48b-b38ac72de992",
                name: [
                  {
                    family: "ROBINSON",
                    given: [
                      "C"
                    ],
                    prefix: [
                      "DR"
                    ]
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:9683c147-ddad-41d9-9858-6e585c3f04df",
              resource: {
                resourceType: "Organization",
                id: "9683c147-ddad-41d9-9858-6e585c3f04df",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "B86044"
                  }
                ],
                name: "IRELAND WOOD SURGERY",
                telecom: [
                  {
                    system: "phone",
                    value: "0113 2303470"
                  }
                ],
                address: [
                  {
                    use: "work",
                    type: "both",
                    line: [
                      "IVESON APPROACH"
                    ],
                    city: "LEEDS",
                    district: "WEST YORKSHIRE",
                    postalCode: "LS16 6FR",
                    country: "ENGLAND"
                  }
                ]
              }
            },
            {
              fullUrl: "urn:uuid:154dcc4a-0006-4272-9758-9dcb8d95ce8b",
              resource: {
                resourceType: "Organization",
                id: "154dcc4a-0006-4272-9758-9dcb8d95ce8b",
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "FEW08"
                  }
                ],
                name: "Pharmica",
                telecom: [
                  {
                    system: "phone",
                    use: "work",
                    value: "020 71129014"
                  },
                  {
                    system: "url",
                    use: "work",
                    value: "www.pharmica.co.uk"
                  }
                ],
                address: [
                  {
                    use: "work",
                    type: "both",
                    line: [
                      "1-5 Clerkenwell Road"
                    ],
                    city: "LONDON",
                    district: "GREATER LONDON",
                    postalCode: "EC1M 5PA"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        fullUrl: "urn:uuid:1a388581-dbbe-43e3-9054-f5976c0245e5",
        search: {
          mode: "outcome"
        },
        resource: {
          resourceType: "OperationOutcome",
          id: "1a388581-dbbe-43e3-9054-f5976c0245e5",
          meta: {
            lastUpdated: "2023-09-29T10:52:00+00:00"
          },
          issue: [
            {
              code: "business-rule",
              severity: "warning",
              details: {
                coding: [
                  {
                    system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
                    code: "INVALIDATED_RESOURCE",
                    display: "Invalidated resource"
                  }
                ]
              },
              diagnostics: "Prescription with short form ID D7AC09-A99968-4BA59C has been invalidated so could not be returned."
            }
          ]
        }
      },
      {
        fullUrl: "urn:uuid:fedef61e-bc62-452e-91c0-6f44ad2d5c0c",
        search: {
          mode: "outcome"
        },
        resource: {
          resourceType: "OperationOutcome",
          id: "fedef61e-bc62-452e-91c0-6f44ad2d5c0c",
          meta: {
            lastUpdated: "2023-09-29T10:52:00+00:00"
          },
          issue: [
            {
              code: "business-rule",
              severity: "warning",
              details: {
                coding: [
                  {
                    system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
                    code: "INVALIDATED_RESOURCE",
                    display: "Invalidated resource"
                  }
                ]
              },
              diagnostics: "Prescription with short form ID CDF34E-A99968-4FF3BQ has been invalidated so could not be returned."
            }
          ]
        }
      }
    ]
  }
}
