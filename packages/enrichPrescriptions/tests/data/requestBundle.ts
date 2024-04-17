import {Bundle} from "fhir/r4"

export function requestBundle(): Bundle {
  return {
    resourceType: "Bundle",
    id: "3f03c9df-111e-4746-ad9b-3a0c8ee65f89",
    meta: {
      lastUpdated: "2024-04-17T08:54:59+00:00"
    },
    type: "searchset",
    total: 1,
    entry: [
      {
        fullUrl: "urn:uuid:a67af4c7-da7c-4edd-a887-0c75a1b2963a",
        search: {
          mode: "match"
        },
        resource: {
          resourceType: "Bundle",
          type: "collection",
          entry: [
            {
              fullUrl: "urn:uuid:e76812cf-c893-42ff-ab02-b19ea1fa11b4",
              resource: {
                id: "e76812cf-c893-42ff-ab02-b19ea1fa11b4",
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
                    reference: "urn:uuid:473e6278-af56-4767-9019-9757f4c0f595"
                  },
                  quantity: {
                    code: "258682000",
                    system: "https://snomed.info/sct",
                    unit: "gram",
                    value: 15
                  },
                  validityPeriod: {
                    start: "2023-11-12"
                  }
                },
                groupIdentifier: {
                  system: "https://fhir.nhs.uk/Id/prescription-order-number",
                  value: "727066-A83008-2EFE36"
                },
                intent: "order",
                medicationCodeableConcept: {
                  coding: [
                    {
                      code: "41898711000001103",
                      display: "Fusidic acid 2% cream",
                      system: "https://snomed.info/sct"
                    }
                  ]
                },
                requester: {
                  reference: "urn:uuid:9d4afe92-348e-4f10-9ba5-67e7712eb8a1"
                },
                status: "unknown",
                subject: {
                  identifier: {
                    system: "https://fhir.nhs.uk/Id/nhs-number",
                    value: "5623367550"
                  }
                },
                substitution: {
                  allowedBoolean: false
                },
                resourceType: "MedicationRequest"
              }
            },
            {
              fullUrl: "urn:uuid:38e84dc6-6941-48e9-bc32-e0fd1469382a",
              resource: {
                id: "38e84dc6-6941-48e9-bc32-e0fd1469382a",
                name: [
                  {
                    family: "Userq",
                    given: [
                      "Random"
                    ]
                  }
                ],
                resourceType: "Practitioner"
              }
            },
            {
              fullUrl: "urn:uuid:9d4afe92-348e-4f10-9ba5-67e7712eb8a1",
              resource: {
                id: "9d4afe92-348e-4f10-9ba5-67e7712eb8a1",
                organization: {
                  reference: "urn:uuid:56ac7469-3425-43be-bbee-de9b9fe36f07"
                },
                practitioner: {
                  reference: "urn:uuid:38e84dc6-6941-48e9-bc32-e0fd1469382a"
                },
                resourceType: "PractitionerRole"
              }
            },
            {
              fullUrl: "urn:uuid:56ac7469-3425-43be-bbee-de9b9fe36f07",
              resource: {
                id: "56ac7469-3425-43be-bbee-de9b9fe36f07",
                address: [
                  {
                    line: [
                      "SWAN STREET",
                      "PETERSFIELD"
                    ],
                    postalCode: "GU32 3LB",
                    type: "both",
                    use: "work"
                  }
                ],
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "Q9N0M"
                  }
                ],
                name: "UTC - PETERSFIELD",
                telecom: [
                  {
                    system: "phone",
                    use: "work",
                    value: "02380874000"
                  }
                ],
                resourceType: "Organization"
              }
            },
            {
              fullUrl: "urn:uuid:473e6278-af56-4767-9019-9757f4c0f595",
              resource: {
                id: "473e6278-af56-4767-9019-9757f4c0f595",
                address: [
                  {
                    text: "1 HAWTHORN PARK, COAL ROAD, LEEDS, WEST YORKSHIRE, LS14 1PQ",
                    type: "both",
                    use: "work"
                  }
                ],
                identifier: [
                  {
                    system: "https://fhir.nhs.uk/Id/ods-organization-code",
                    value: "FLM49"
                  }
                ],
                name: "PHARMACY 2 U LTD",
                resourceType: "Organization",
                telecom: [
                  {
                    system: "url",
                    use: "work",
                    value: "www.pharmacy2u.co.uk"
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
