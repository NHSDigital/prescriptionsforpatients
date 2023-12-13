import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@prescriptionsforpatients/middleware"
import {createSpineClient, NHSNumberValidationError} from "@prescriptionsforpatients/spineClient"
import {LogLevel} from "@aws-lambda-powertools/logger/lib/types"
import type {Bundle} from "fhir/r4"
import {DistanceSelling} from "@prescriptionsforpatients/distanceSelling"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
const servicesCache: Record<string, string> = {}

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
    const returnData = await spineClient.getPrescriptions(event.headers)
    const searchsetBundle: Bundle = returnData.data
    searchsetBundle.id = xRequestId

    const distanceSelling = new DistanceSelling(servicesCache)
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
  .use(injectLambdaContext(logger))
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
  .use(errorHandler({logger}))
