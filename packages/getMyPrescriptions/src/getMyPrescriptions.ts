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
                fullUrl: "urn:uuid:526b31df-e9ae-4423-b205-9692ec617469",
                resource: {
                  id: "526b31df-e9ae-4423-b205-9692ec617469",
                  identifier: [
                    {
                      system: "https://fhir.nhs.uk/Id/prescription-order-item-number",
                      value: "e76812cf-c893-42ff-ab02-b19ea1fa11b4"
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
                      given: ["Random"]
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
                      line: ["SWAN STREET", "PETERSFIELD"],
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
    searchsetBundle.id = xRequestId

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
