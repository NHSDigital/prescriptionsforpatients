import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@prescriptionsforpatients/middleware"
import createSpineClient from "@prescriptionsforpatients/spineClient"

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
  // nhsd-nhslogin-user looks like P9:9912003071
  const nhsNumber = event.headers["nhsd-nhslogin-user"]?.split(":")[1]
  logger.info(`nhsNumber: ${nhsNumber}`)

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const spineClient = createSpineClient()

  const returnData = await spineClient.getPrescriptions(event.headers, logger)
  return {
    statusCode: returnData.status,
    body: returnData.data
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
