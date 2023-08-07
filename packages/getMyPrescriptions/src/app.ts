import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@prescriptionsforpatients/middleware"
import {createSpineClient, NHSNumberValidationError} from "@prescriptionsforpatients/spineClient"

const logger = new Logger({serviceName: "getMyPrescriptions"})

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
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const spineClient = createSpineClient()

  try {
    const returnData = await spineClient.getPrescriptions(event.headers, logger)
    return {
      statusCode: 200,
      body: JSON.stringify(returnData.data),
      headers: {
        "Content-Type": "application/fhir+json"
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
          "Content-Type": "application/fhir+json"
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
        logger.info(request)
      }
    })
  )
  .use(errorHandler({logger}))
