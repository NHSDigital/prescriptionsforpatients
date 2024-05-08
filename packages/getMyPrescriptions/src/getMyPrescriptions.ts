import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
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
  FhirBody,
  stateMachineLambdaResponse
} from "./responses"
import {deepCopy, hasTimedOut, jobWithTimeout} from "./utils"
import {buildStatusUpdateData} from "./statusUpdate"
import {StatusUpdateData} from "./fhirUtils"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const servicesCache: ServicesCache = {}

const LAMBDA_TIMEOUT_MS = 10_000
const SPINE_TIMEOUT_MS = 9_000
const SERVICE_SEARCH_TIMEOUT_MS = 5_000

const shouldGetStatusUpdates = () => process.env.GET_STATUS_UPDATES === "true"

type EventHeaders = Record<string, string | undefined>

export type GetMyPrescriptionsEvent = {
  headers: EventHeaders
}

type ResponseFunc = (
  fhirBody: FhirBody, statusUpdateData?: Array<StatusUpdateData>
) => APIGatewayProxyResult

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

export const stateMachineEventHandler = async (event: GetMyPrescriptionsEvent): Promise<APIGatewayProxyResult> => {
  const handlerResponse = await jobWithTimeout(
    LAMBDA_TIMEOUT_MS,
    eventHandler(event.headers, stateMachineLambdaResponse, shouldGetStatusUpdates())
  )

  if (hasTimedOut(handlerResponse)){
    return TIMEOUT_RESPONSE
  }
  return handlerResponse
}

export const apiGatewayEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  event.headers["apigw-request-id"] = event.requestContext.requestId
  const handlerResponse = await jobWithTimeout(
    LAMBDA_TIMEOUT_MS,
    eventHandler(event.headers, apiGatewayLambdaResponse)
  )

  if (hasTimedOut(handlerResponse)){
    return TIMEOUT_RESPONSE
  }
  return handlerResponse
}

async function eventHandler(headers: EventHeaders, successResponse: ResponseFunc, includeStatusUpdateData: boolean = false): Promise<APIGatewayProxyResult> {
  const xRequestId = headers["x-request-id"]
  const requestId = headers["apigw-request-id"]

  logger.appendKeys({
    "nhsd-correlation-id": headers["nhsd-correlation-id"],
    "x-request-id": xRequestId,
    "nhsd-request-id": headers["nhsd-request-id"],
    "x-correlation-id": headers["x-correlation-id"],
    "apigw-request-id": requestId
  })
  const spineClient = createSpineClient(logger)

  try {
    const isCertificateConfigured = spineClient.isCertificateConfigured()
    if (!isCertificateConfigured) {
      return SPINE_CERT_NOT_CONFIGURED_RESPONSE
    }

    const nhsNumber = extractNHSNumber(headers["nhsd-nhslogin-user"])
    logger.info(`nhsNumber: ${nhsNumber}`)
    headers["nhsNumber"] = nhsNumber

    const spineCallout = spineClient.getPrescriptions(headers)
    const response = await jobWithTimeout(SPINE_TIMEOUT_MS, spineCallout)
    if (hasTimedOut(response)){
      return TIMEOUT_RESPONSE
    }
    const searchsetBundle: Bundle = response.data
    searchsetBundle.id = xRequestId

    const statusUpdateData = includeStatusUpdateData ? buildStatusUpdateData(searchsetBundle) : undefined

    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const distanceSellingBundle = deepCopy(searchsetBundle)
    const distanceSellingCallout = distanceSelling.search(distanceSellingBundle)
    const distanceSellingResponse = await jobWithTimeout(SERVICE_SEARCH_TIMEOUT_MS, distanceSellingCallout)
    if (hasTimedOut(distanceSellingResponse)){
      return successResponse(searchsetBundle, statusUpdateData)
    }

    return successResponse(distanceSellingBundle, statusUpdateData)
  } catch (error) {
    if (error instanceof NHSNumberValidationError) {
      return INVALID_NHS_NUMBER_RESPONSE
    } else {
      throw error
    }
  }
}

export const stateMachineHandler = middy(stateMachineEventHandler)
  .use(injectLambdaContext(logger, {clearState: true}))
  .use(
    inputOutputLogger({
      logger: (request) => {
        if (request.response) {
          logger.debug(request)
        } else {
          logger.info(request)
        }
      }
    })
  )

export const apiGatewayHandler = middy(apiGatewayEventHandler)
  .use(injectLambdaContext(logger, {clearState: true}))
  .use(
    inputOutputLogger({
      logger: (request) => {
        if (request.response) {
          logger.debug(request)
        } else {
          logger.info(request)
        }
      }
    })
  )
  .use(errorHandler({logger: logger}))
