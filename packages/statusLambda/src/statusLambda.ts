import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@prescriptionsforpatients/middleware"
import {createSpineClient, StatusCheckResponse} from "@prescriptionsforpatients/spineClient"

// Define a type for the response body
interface ResponseBody {
  commitId: string | undefined
  versionNumber: string | undefined
  status: string
  spineStatus: StatusCheckResponse
  message?: string // Optional message property
}

const logger = new Logger({serviceName: "status"})

/* eslint-disable  max-len */

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} _event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.appendKeys({
    "nhsd-correlation-id": event.headers["nhsd-correlation-id"],
    "x-request-id": event.headers["x-request-id"],
    "nhsd-request-id": event.headers["nhsd-request-id"],
    "x-correlation-id": event.headers["x-correlation-id"],
    "apigw-request-id": event.requestContext.requestId
  })

  const spineClient = createSpineClient()

  const spineStatus = await spineClient.getStatus(logger)

  const commitId = process.env.COMMIT_ID
  const versionNumber = process.env.VERSION_NUMBER

  // Check if the Spine certificate is configured
  const isCertificateConfigured = await spineClient.isCertificateConfigured()

  // Define the response body
  const responseBody: ResponseBody = {
    commitId: commitId,
    versionNumber: versionNumber,
    status: spineStatus.status,
    spineStatus: spineStatus
  }

  // Add a message if the Spine certificate is not configured and Spine check not fails
  if (!isCertificateConfigured && spineStatus.responseCode !== 500) {
    responseBody.message = "Spine certificate is not configured"
  }

  return {
    statusCode: 200,
    body: JSON.stringify(responseBody),
    headers: {
      "Content-Type": "application/health+json",
      "Cache-Control": "no-cache"
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
