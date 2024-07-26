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

    const spineCallout = spineClient.getPrescriptions(headers)
    const response = await jobWithTimeout(params.spineTimeoutMs, spineCallout)
    if (hasTimedOut(response)) {
      logger.error("Call to Spine has timed out. Returning error response.")
      return TIMEOUT_RESPONSE
    }
    const searchsetBundle: Bundle = response.data
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
      logger.info("serviceSearch request timed out", {
        timeout: SERVICE_SEARCH_TIMEOUT_MS,
        message: `The request to the distance selling service timed out after ${SERVICE_SEARCH_TIMEOUT_MS}ms.`
      })
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
