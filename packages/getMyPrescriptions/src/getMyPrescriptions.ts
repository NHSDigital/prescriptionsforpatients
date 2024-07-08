import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import httpHeaderNormalizer from "@middy/http-header-normalizer"
import errorHandler from "@nhs/fhir-middy-error-handler"
import {createSpineClient} from "@nhsdigital/eps-spine-client"
import {extractNHSNumber, NHSNumberValidationError} from "./extractNHSNumber"
import {DistanceSelling, ServicesCache} from "@prescriptionsforpatients/distanceSelling"
import type {Bundle} from "fhir/r4"
import {
  INVALID_NHS_NUMBER_RESPONSE,
  SPINE_CERT_NOT_CONFIGURED_RESPONSE,
  TIMEOUT_RESPONSE,
  apiGatewayLambdaResponse,
  stateMachineLambdaResponse,
  TraceIDs,
  ResponseFunc
} from "./responses"
import {deepCopy, hasTimedOut, jobWithTimeout} from "./utils"
import {buildStatusUpdateData, shouldGetStatusUpdates} from "./statusUpdate"
import {SpineClient} from "@nhsdigital/eps-spine-client/lib/spine-client"
import {isolateOperationOutcome} from "./fhirUtils"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
export const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const _spineClient = createSpineClient(logger)

const servicesCache: ServicesCache = {}

const LAMBDA_TIMEOUT_MS = 10_000
const SPINE_TIMEOUT_MS = 9_000
const SERVICE_SEARCH_TIMEOUT_MS = 5_000

type EventHeaders = Record<string, string | undefined>

export type GetMyPrescriptionsEvent = {
  rawHeaders: Record<string, string>
  headers: EventHeaders
}

/* eslint-disable  max-len */

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export const stateMachineEventHandler = async (
  event: GetMyPrescriptionsEvent,
  params: HandlerParams
): Promise<APIGatewayProxyResult> => {
  const handlerResponse = await jobWithTimeout(
    params.lambdaTimeoutMs,
    eventHandler(params, event.headers, stateMachineLambdaResponse, shouldGetStatusUpdates())
  )

  if (hasTimedOut(handlerResponse)) {
    logger.error("Lambda handler has timed out. Returning error response.")
    return TIMEOUT_RESPONSE
  }
  return handlerResponse
}

export const apiGatewayEventHandler = async (
  event: APIGatewayProxyEvent,
  params: HandlerParams
): Promise<APIGatewayProxyResult> => {
  event.headers["apigw-request-id"] = event.requestContext.requestId
  const handlerResponse = await jobWithTimeout(
    params.lambdaTimeoutMs,
    eventHandler(params, event.headers, apiGatewayLambdaResponse)
  )

  if (hasTimedOut(handlerResponse)) {
    logger.error("Lambda handler has timed out. Returning error response.")
    return TIMEOUT_RESPONSE
  }
  return handlerResponse
}

async function eventHandler(
  params: HandlerParams,
  headers: EventHeaders,
  successResponse: ResponseFunc,
  includeStatusUpdateData: boolean = false
): Promise<APIGatewayProxyResult> {
  const xRequestId = headers["x-request-id"]
  const requestId = headers["apigw-request-id"]
  const spineClient = params.spineClient

  const traceIDs: TraceIDs = {
    "nhsd-correlation-id": headers["nhsd-correlation-id"],
    "x-request-id": xRequestId,
    "nhsd-request-id": headers["nhsd-request-id"],
    "x-correlation-id": headers["x-correlation-id"],
    "apigw-request-id": requestId
  }
  logger.appendKeys(traceIDs)

  try {
    const isCertificateConfigured = spineClient.isCertificateConfigured()
    if (!isCertificateConfigured) {
      return SPINE_CERT_NOT_CONFIGURED_RESPONSE
    }

    const nhsNumber = extractNHSNumber(headers["nhsd-nhslogin-user"])
    logger.info(`nhsNumber: ${nhsNumber}`)
    headers["nhsNumber"] = nhsNumber

    // const spineCallout = spineClient.getPrescriptions(headers)
    // const response = await jobWithTimeout(params.spineTimeoutMs, spineCallout)
    // if (hasTimedOut(response)){
    //   logger.error("Call to Spine has timed out. Returning error response.")
    //   return TIMEOUT_RESPONSE
    // }
    const searchsetBundle: Bundle = {
      resourceType: "Bundle",
      id: "test-request-id",
      meta: {
        lastUpdated: "2022-11-21T14:00:00+00:00"
      },
      type: "searchset",
      total: 3,
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
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
                      extension: [
                        {
                          url: "status",
                          valueCoding: {
                            system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                            code: "With Pharmacy but Tracking not Supported"
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
                  status: "active",
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
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
                      extension: [
                        {
                          url: "status",
                          valueCoding: {
                            system: "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt",
                            code: "With Pharmacy but Tracking not Supported"
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
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
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
                      url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
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
                          valueDateTime: "2023-09-11T10:11:12.000Z"
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
                      given: ["C"],
                      prefix: ["DR"]
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
                      line: ["HALLGARTH SURGERY", "CHEAPSIDE"],
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
                      line: ["Unit 4B", "Victoria Road"],
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
                  }
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
                      given: ["C"],
                      prefix: ["DR"]
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
                      line: ["IVESON APPROACH"],
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
                  }
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
                      given: ["C"],
                      prefix: ["DR"]
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
                      line: ["IVESON APPROACH"],
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
                      line: ["1-5 Clerkenwell Road"],
                      city: "LONDON",
                      district: "GREATER LONDON",
                      postalCode: "EC1M 5PA"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
    searchsetBundle.id = xRequestId

    const operationOutcomes = isolateOperationOutcome(searchsetBundle)
    operationOutcomes.forEach((operationOutcome) => {
      logger.error("Operation outcome returned from spine", {operationOutcome})
    })

    const statusUpdateData = includeStatusUpdateData ? buildStatusUpdateData(searchsetBundle) : undefined

    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const distanceSellingBundle = deepCopy(searchsetBundle)
    const distanceSellingCallout = distanceSelling.search(distanceSellingBundle)
    const distanceSellingResponse = await jobWithTimeout(params.serviceSearchTimeoutMs, distanceSellingCallout)
    if (hasTimedOut(distanceSellingResponse)) {
      return successResponse(searchsetBundle, traceIDs, statusUpdateData)
    }

    return successResponse(distanceSellingBundle, traceIDs, statusUpdateData)
  } catch (error) {
    if (error instanceof NHSNumberValidationError) {
      return INVALID_NHS_NUMBER_RESPONSE
    } else {
      throw error
    }
  }
}

type HandlerConfig<T> = {
  handlerFunction: (event: T, config: HandlerParams) => Promise<APIGatewayProxyResult>
  middleware: Array<middy.MiddlewareObj>
  params: HandlerParams
}

type HandlerParams = {
  lambdaTimeoutMs: number
  spineTimeoutMs: number
  serviceSearchTimeoutMs: number
  spineClient: SpineClient
}
export const DEFAULT_HANDLER_PARAMS = {
  lambdaTimeoutMs: LAMBDA_TIMEOUT_MS,
  spineTimeoutMs: SPINE_TIMEOUT_MS,
  serviceSearchTimeoutMs: SERVICE_SEARCH_TIMEOUT_MS,
  spineClient: _spineClient
}

export const newHandler = <T>(handlerConfig: HandlerConfig<T>) => {
  const newHandler = middy((event: T) => handlerConfig.handlerFunction(event, handlerConfig.params))
  for (const middleware of handlerConfig.middleware) {
    newHandler.use(middleware)
  }
  return newHandler
}

const MIDDLEWARE = {
  injectLambdaContext: injectLambdaContext(logger, {clearState: true}),
  httpHeaderNormalizer: httpHeaderNormalizer() as middy.MiddlewareObj,
  inputOutputLogger: inputOutputLogger({
    logger: (request) => {
      if (request.response) {
        logger.debug(request)
      } else {
        logger.info(request)
      }
    }
  }),
  errorHandler: errorHandler({logger: logger})
}

export const STATE_MACHINE_MIDDLEWARE = [
  MIDDLEWARE.injectLambdaContext,
  MIDDLEWARE.httpHeaderNormalizer,
  MIDDLEWARE.inputOutputLogger
]
export const handler = newHandler({
  handlerFunction: stateMachineEventHandler,
  params: DEFAULT_HANDLER_PARAMS,
  middleware: STATE_MACHINE_MIDDLEWARE
})

export const API_GATEWAY_MIDDLEWARE = [
  MIDDLEWARE.injectLambdaContext,
  MIDDLEWARE.inputOutputLogger,
  MIDDLEWARE.errorHandler
]
export const apiGatewayHandler = newHandler({
  handlerFunction: apiGatewayEventHandler,
  params: DEFAULT_HANDLER_PARAMS,
  middleware: API_GATEWAY_MIDDLEWARE
})
