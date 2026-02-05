import {APIGatewayProxyResult as LambdaResult} from "aws-lambda"
import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"

import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import httpHeaderNormalizer from "@middy/http-header-normalizer"

import errorHandler from "@nhs/fhir-middy-error-handler"
import type {Bundle} from "fhir/r4"

import {createSpineClient} from "@nhsdigital/eps-spine-client"
import {SpineClient} from "@nhsdigital/eps-spine-client/lib/spine-client"

import {DistanceSelling, ServicesCache} from "@prescriptionsforpatients/distanceSelling"
import {
  INVALID_NHS_NUMBER_RESPONSE,
  SPINE_CERT_NOT_CONFIGURED_RESPONSE,
  TIMEOUT_RESPONSE,
  TC008_ERROR_RESPONSE,
  stateMachineLambdaResponse,
  TraceIDs,
  ResponseFunc
} from "./responses"
import {extractNHSNumberFromHeaders, NHSNumberValidationError, validateNHSNumber} from "./extractNHSNumber"
import {hasTimedOut, jobWithTimeout, NHS_LOGIN_HEADER} from "./utils"
import {buildStatusUpdateData, shouldGetStatusUpdates} from "./statusUpdate"
import {extractOdsCodes, isolateOperationOutcome} from "./fhirUtils"
import {pfpConfig, PfPConfig} from "@pfp-common/utilities"
import {
  PrescriptionTimeoutError,
  SpineCertNotConfiguredError,
  TC008TestError,
  type EventHeaders
} from "./types"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
export const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const _spineClient = createSpineClient(logger)

const servicesCache: ServicesCache = {}

const LAMBDA_TIMEOUT_MS = 10_000
const SPINE_TIMEOUT_MS = 9_000
const SERVICE_SEARCH_TIMEOUT_MS = 5_000
export const DELEGATED_ACCESS_HDR = "x-nhsd-delegated-access"
export const DELEGATED_ACCESS_SUB_HDR = "x-nhsd-subject-nhs-number"

export type GetMyPrescriptionsEvent = {
  rawHeaders: Record<string, string>
  headers: EventHeaders
}

/**
 *
 * @param {Object} event - Step function input event
 *
 * @returns {Object} object - Lambda output response
 *
 */
export const stateMachineEventHandler = async (
  event: GetMyPrescriptionsEvent,
  params: HandlerParams
): Promise<LambdaResult> => {
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

async function eventHandler(
  params: HandlerParams,
  headers: EventHeaders,
  successResponse: ResponseFunc,
  includeStatusUpdateData: boolean = false
): Promise<LambdaResult> {
  const traceIDs: TraceIDs = logTraceIds(headers)
  const spineClient = params.spineClient
  const applicationName = headers["nhsd-application-name"] ?? "unknown"
  const correlationId = headers["nhsd-correlation-id"] ?? crypto.randomUUID()

  checkSpineCertificateConfiguration(spineClient)
  await handleTestCaseIfApplicable(params, headers)
  headers = overrideNonProductionHeadersForProxygenRequests(headers)
  headers = adaptHeadersToSpine(headers)

  const response = await makeSpinePrescriptionCall(spineClient, headers, params)
  const searchsetBundle: Bundle = response.data
  logPrescriptionResponse(searchsetBundle, traceIDs, headers, applicationName)

  const statusUpdateData = includeStatusUpdateData ? buildStatusUpdateData(logger, searchsetBundle) : undefined

  const distanceSelling = new DistanceSelling(servicesCache, logger)
  const distanceSellingBundle = structuredClone(searchsetBundle)
  const distanceSellingCallout = distanceSelling.search(distanceSellingBundle, correlationId)

  const distanceSellingResponse = await jobWithTimeout(params.serviceSearchTimeoutMs, distanceSellingCallout)
  if (hasTimedOut(distanceSellingResponse)) {
    logger.warn("serviceSearch request timed out", {
      timeout: SERVICE_SEARCH_TIMEOUT_MS,
      message: `The request to the distance selling service timed out after ${SERVICE_SEARCH_TIMEOUT_MS}ms.`
    })
    return await successResponse(
      logger, headers["nhsNumber"]!, searchsetBundle, traceIDs, params.pfpConfig, statusUpdateData
    )
  }

  return await successResponse(
    logger, headers["nhsNumber"]!, distanceSellingBundle, traceIDs,
    params.pfpConfig, statusUpdateData
  )
}

function logTraceIds(headers: EventHeaders) {
  const traceIDs: TraceIDs = {
    "nhsd-correlation-id": headers["nhsd-correlation-id"],
    "x-request-id": headers["x-request-id"],
    "nhsd-request-id": headers["nhsd-request-id"],
    "x-correlation-id": headers["x-correlation-id"],
    "apigw-request-id": headers["apigw-request-id"]
  }
  logger.appendKeys(traceIDs)
  return traceIDs
}

function logPrescriptionResponse(searchsetBundle: Bundle,
  traceIDs: TraceIDs, headers: EventHeaders, applicationName: string) {
  searchsetBundle.id = traceIDs["x-request-id"] || "unknown"

  const operationOutcomes = isolateOperationOutcome(searchsetBundle)
  operationOutcomes.forEach((operationOutcome) => {
    logger.error("Operation outcome returned from spine", {operationOutcome})
  })

  const ODSCodes = extractOdsCodes(logger, searchsetBundle)
  logger.info(
    "Processing PfP get prescriptions request for patient. "
    + "They have these relevant ODS codes, and the PfP request was made via this apigee application.",
    {
      ODSCodes,
      actorNhsNumber: headers[NHS_LOGIN_HEADER],
      subjectNhsNumber: headers["nhsNumber"],
      applicationName
    }
  )
}

async function makeSpinePrescriptionCall(spineClient: SpineClient, headers: EventHeaders, params: HandlerParams) {
  const spineCallout = spineClient.getPrescriptions(headers)
  const response = await jobWithTimeout(params.spineTimeoutMs, spineCallout)
  if (hasTimedOut(response)) {
    logger.error("Call to Spine has timed out. Returning error response.")
    throw new PrescriptionTimeoutError("Call to Spine has timed out")
  }
  return response
}

function checkSpineCertificateConfiguration(spineClient: SpineClient) {
  const isCertificateConfigured = spineClient.isCertificateConfigured()
  if (!isCertificateConfigured) {
    throw new SpineCertNotConfiguredError()
  }
}

async function handleTestCaseIfApplicable(params: HandlerParams, headers: EventHeaders) {
  if (await params.pfpConfig.isTC008(headers["nhsNumber"]!)) {
    logger.info("Test NHS number corresponding to TC008 has been received. Returning a 500 response")
    throw new TC008TestError()
  }
}

export function overrideNonProductionHeadersForProxygenRequests(headers: EventHeaders): EventHeaders {
  // Used in non-prod environments to set the nhsNumber header for testing purposes
  if (headers["x-nhs-number"]
      && process.env.ALLOW_NHS_NUMBER_OVERRIDE === "true"
      && headers["nhs-login-identity-proofing-level"]
  ) {
    // For proxygen based testing, we need to prepend the proofing level to match non-proxygen implementation
    // See prescriptions-for-patients repo for AssignMessage.OverridePatientAccessHeader.xml
    headers[NHS_LOGIN_HEADER] = headers["x-nhs-number"]
    logger.info("Set non production headers for Spine call", {headers})
  }
  return headers
}

export function adaptHeadersToSpine(headers: EventHeaders): EventHeaders {
  // AEA-3344 introduces delegated access using different headers
  logger.debug("Testing if delegated access enabled", {headers})
  if (!headers[DELEGATED_ACCESS_HDR] || headers[DELEGATED_ACCESS_HDR].toLowerCase() !== "true") {
    logger.info("Subject access request detected")
    headers["nhsNumber"] = extractNHSNumberFromHeaders(headers)
  } else {
    logger.info("Delegated access request detected")
    let subjectNHSNumber = headers[DELEGATED_ACCESS_SUB_HDR]
    if (!subjectNHSNumber) {
      throw new NHSNumberValidationError(`${DELEGATED_ACCESS_SUB_HDR} header not present for delegated access`)
    }
    if (subjectNHSNumber.includes(":")) {
      logger.warn(`${DELEGATED_ACCESS_SUB_HDR} is not expected to be prefixed by proofing level, but is, removing it`)
      subjectNHSNumber = subjectNHSNumber.split(":")[1]
    }
    headers["nhsNumber"] = validateNHSNumber(subjectNHSNumber)
  }
  logger.info(`after setting subject nhsNumber`, {headers})
  return headers
}

type HandlerConfig<T> = {
  handlerFunction: (event: T, config: HandlerParams) => Promise<LambdaResult>
  middleware: Array<middy.MiddlewareObj>
  params: HandlerParams
}

type HandlerParams = {
  lambdaTimeoutMs: number
  spineTimeoutMs: number
  serviceSearchTimeoutMs: number
  spineClient: SpineClient
  pfpConfig: PfPConfig
}
export const DEFAULT_HANDLER_PARAMS = {
  lambdaTimeoutMs: LAMBDA_TIMEOUT_MS,
  spineTimeoutMs: SPINE_TIMEOUT_MS,
  serviceSearchTimeoutMs: SERVICE_SEARCH_TIMEOUT_MS,
  spineClient: _spineClient,
  pfpConfig: pfpConfig
}

export const newHandler = <T>(handlerConfig: HandlerConfig<T>) => {
  const newHandler = middy((event: T) => handlerConfig.handlerFunction(event, handlerConfig.params))
  for (const middleware of handlerConfig.middleware) {
    newHandler.use(middleware)
  }
  return newHandler
}

// Custom middleware to handle our domain-specific errors
const customErrorHandler = (): middy.MiddlewareObj => ({
  onError: async (request) => {
    const error = request.error
    if (error instanceof SpineCertNotConfiguredError) {
      request.response = SPINE_CERT_NOT_CONFIGURED_RESPONSE
    } else if (error instanceof TC008TestError) {
      request.response = TC008_ERROR_RESPONSE
    } else if (error instanceof PrescriptionTimeoutError) {
      request.response = TIMEOUT_RESPONSE
    } else if (error instanceof NHSNumberValidationError) {
      request.response = INVALID_NHS_NUMBER_RESPONSE
    }
    // Let other errors propagate to the generic error handler
  }
})

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
  customErrorHandler: customErrorHandler(),
  errorHandler: errorHandler({logger: logger})
}

export const STATE_MACHINE_MIDDLEWARE: Array<middy.MiddlewareObj> = [
  MIDDLEWARE.injectLambdaContext,
  MIDDLEWARE.httpHeaderNormalizer,
  MIDDLEWARE.inputOutputLogger,
  MIDDLEWARE.customErrorHandler,
  MIDDLEWARE.errorHandler
]
export const handler = newHandler({
  handlerFunction: stateMachineEventHandler,
  params: DEFAULT_HANDLER_PARAMS,
  middleware: STATE_MACHINE_MIDDLEWARE
})
