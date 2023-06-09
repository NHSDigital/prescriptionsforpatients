import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@schibsted/middy-error-handler"

const logger = new Logger({serviceName: "authz"})

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

/* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info("hello world from authz logger")

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello Kris from authz lambda!"
    })
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
