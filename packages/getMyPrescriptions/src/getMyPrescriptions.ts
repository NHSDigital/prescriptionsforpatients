import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {createSpineClient} from "@nhsdigital/eps-spine-client"
import {extractNHSNumber, NHSNumberValidationError} from "./extractNHSNumber"
import {DistanceSelling, ServicesCache} from "@prescriptionsforpatients/distanceSelling"
import type {Bundle} from "fhir/r4"
import {
  FhirBody,
  INVALID_NHS_NUMBER_RESPONSE,
  SPINE_CERT_NOT_CONFIGURED_RESPONSE,
  StateMachineFunctionResponse,
  TIMEOUT_RESPONSE,
  generalError,
  stateMachineLambdaResponse,
  apiGatewayLambdaResponse
} from "./responses"
import {deepCopy, hasTimedOut, jobWithTimeout} from "./utils"
import {buildStatusUpdateData} from "./statusUpdate"
import {tempBundle} from "./tempBundle"
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {StatusUpdateData} from "./fhirUtils"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const servicesCache: ServicesCache = {}

const LAMBDA_TIMEOUT_MS = 10_000
const SPINE_TIMEOUT_MS = 9_000
const SERVICE_SEARCH_TIMEOUT_MS = 5_000

type EventHeaders = Record<string, string | undefined>

export type GetMyPrescriptionsEvent = {
  headers: EventHeaders
}

type ResponseFunc<T> = (statusCode: number, fhirBody: FhirBody, statusUpdateData?: Array<StatusUpdateData>) => T

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

export const stateMachineEventHandler = async (event: GetMyPrescriptionsEvent): Promise<StateMachineFunctionResponse> => {
  const handlerResponse = await jobWithTimeout(
    LAMBDA_TIMEOUT_MS,
    eventHandler<StateMachineFunctionResponse>(event.headers, stateMachineLambdaResponse)
  )

  if (hasTimedOut(handlerResponse)){
    return stateMachineLambdaResponse(408, TIMEOUT_RESPONSE)
  }
  return handlerResponse
}

export const apiGatewayEventHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  event.headers["apigw-request-id"] = event.requestContext.requestId
  const handlerResponse = await jobWithTimeout(
    LAMBDA_TIMEOUT_MS,
    eventHandler<APIGatewayProxyResult>(event.headers, apiGatewayLambdaResponse)
  )

  if (hasTimedOut(handlerResponse)){
    return apiGatewayLambdaResponse(408, TIMEOUT_RESPONSE)
  }
  return handlerResponse
}

async function eventHandler<T>(headers: EventHeaders, createResponse: ResponseFunc<T>): Promise<T> {
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
      return createResponse(500, SPINE_CERT_NOT_CONFIGURED_RESPONSE)
    }

    const nhsNumber = extractNHSNumber(headers["nhsd-nhslogin-user"])
    logger.info(`nhsNumber: ${nhsNumber}`)
    headers["nhsNumber"] = nhsNumber

    const spineCallout = spineClient.getPrescriptions(headers)
    const response = await jobWithTimeout(SPINE_TIMEOUT_MS, spineCallout)
    if (hasTimedOut(response)){
      return createResponse(408, TIMEOUT_RESPONSE)
    }
    const searchsetBundle: Bundle = tempBundle()
    searchsetBundle.id = xRequestId

    const statusUpdateData = buildStatusUpdateData(searchsetBundle)

    const distanceSellingBundle = deepCopy(searchsetBundle)
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const distanceSellingCallout = distanceSelling.search(distanceSellingBundle)

    const distanceSellingResponse = await jobWithTimeout(SERVICE_SEARCH_TIMEOUT_MS, distanceSellingCallout)
    if (hasTimedOut(distanceSellingResponse)){
      return createResponse(200, searchsetBundle, statusUpdateData)
    }

    return createResponse(200, distanceSellingBundle, statusUpdateData)
  } catch (error) {
    if (error instanceof NHSNumberValidationError) {
      return createResponse(400, INVALID_NHS_NUMBER_RESPONSE)
    } else {
      return createResponse(500, generalError(requestId))
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
