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

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const servicesCache: ServicesCache = {}

type Milliseconds = number
const LAMBDA_TIMEOUT: Milliseconds = 10_000
const SPINE_TIMEOUT: Milliseconds = 9_000

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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return timeoutHandler(LAMBDA_TIMEOUT, eventHandler(event))
}

type Timeout = {
  statusCode: number
  body: string
}
async function timeoutHandler<T>(timeout: Milliseconds, job: Promise<T>): Promise<T | Timeout> {
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({statusCode: 504, body: "Request Timed Out"})
    }, timeout)
  }) as Promise<Timeout>
  return Promise.race([job, timeoutPromise])
}

export async function eventHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const xRequestId = event.headers["x-request-id"]
  logger.appendKeys({
    "nhsd-correlation-id": event.headers["nhsd-correlation-id"],
    "x-request-id": xRequestId,
    "nhsd-request-id": event.headers["nhsd-request-id"],
    "x-correlation-id": event.headers["x-correlation-id"],
    "apigw-request-id": event.requestContext.requestId
  })
  const spineClient = createSpineClient(logger)

  try {
    const isCertificateConfigured = spineClient.isCertificateConfigured()
    if (!isCertificateConfigured) {
      const errorResponseBody = {
        resourceType: "OperationOutcome",
        issue: [
          {
            code: "security",
            severity: "fatal",
            details: {
              coding: [
                {
                  system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
                  code: "SERVER_ERROR",
                  display: "500: The Server has encountered an error processing the request."
                }
              ]
            },
            diagnostics: "Spine certificate is not configured"
          }
        ]
      }
      return {
        statusCode: 500,
        body: JSON.stringify(errorResponseBody),
        headers: {
          "Content-Type": "application/fhir+json",
          "Cache-Control": "no-cache"
        }
      }
    }
    const nhsNumber = extractNHSNumber(event.headers["nhsd-nhslogin-user"])
    logger.info(`nhsNumber: ${nhsNumber}`)
    event.headers["nhsNumber"] = nhsNumber

    const spineCallout = spineClient.getPrescriptions(event.headers)
    const response = await timeoutHandler(SPINE_TIMEOUT, spineCallout)
    if ((response as Timeout).statusCode === 504){
      return response as APIGatewayProxyResult
    }
    const returnData = await spineCallout

    const searchsetBundle: Bundle = returnData.data
    searchsetBundle.id = xRequestId

    const distanceSelling = new DistanceSelling(servicesCache, logger)
    await distanceSelling.search(searchsetBundle)

    return {
      statusCode: 200,
      body: JSON.stringify(searchsetBundle),
      headers: {
        "Content-Type": "application/fhir+json",
        "Cache-Control": "no-cache"
      }
    }
  } catch (error) {
    if (error instanceof NHSNumberValidationError) {
      const errorResponseBody = {
        resourceType: "OperationOutcome",
        issue: [
          {
            code: "value",
            severity: "error",
            details: {
              coding: [
                {
                  system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
                  code: "INVALID_RESOURCE_ID",
                  display: "Invalid resource ID"
                }
              ]
            }
          }
        ]
      }
      return {
        statusCode: 400,
        body: JSON.stringify(errorResponseBody),
        headers: {
          "Content-Type": "application/fhir+json",
          "Cache-Control": "no-cache"
        }
      }
    } else {
      throw error
    }
  }
}

export const handler = middy(lambdaHandler)
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
