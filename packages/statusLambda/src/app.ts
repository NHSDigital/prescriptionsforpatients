import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"

const logger = new Logger({serviceName: "status"})

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
  logger.info(`hello world from status logger`)

  // Check connection to spine using code common with getMyPrescriptions

  // Return type to test different responses
  const returnType = event.queryStringParameters?.returnType
  logger.info({message: "value of returnType", returnType})

  let responseStatus
  let responseChecks
  switch (returnType) {
    case "pass":
      responseStatus = "pass"
      responseChecks = [{}]
      break
    case "warn":
      responseStatus = "warn"
      responseChecks = [
        {
          message: "Warning about something non-critical"
        }
      ]
      break
    case "error":
    default:
      responseStatus = "error"
      responseChecks = [
        {
          message: "There is an error somewhere"
        },
        {
          message: "And another one somewhere else"
        }
      ]
      break
  }

  const commitId = process.env.COMMIT_ID ?? "Some version number"

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: responseStatus,
      commitId: commitId,
      checks: responseChecks
    }),
    headers: {
      "Content-Type": "application/json"
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
