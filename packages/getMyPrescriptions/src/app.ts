import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@middleware/src"
import {getSecret} from "@aws-lambda-powertools/parameters/secrets"

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
  let spinePrivateKey: string | undefined
  let spinePublicCertificate: string | undefined
  let spineASIDARN: string | undefined
  if (process.env.SpinePrivateKeyARN !== undefined) {
    spinePrivateKey = await getSecret(process.env.SpinePrivateKeyARN)
  }
  if (process.env.SpinePublicCertificateARN !== undefined) {
    spinePublicCertificate = await getSecret(process.env.SpinePublicCertificateARN)
  }
  if (process.env.SpineASIDARN !== undefined) {
    spineASIDARN = await getSecret(process.env.SpineASIDARN)
  }

  const targetSpineServer = process.env.TargetSpineServer
  logger.info(`hello world from getMyPrescriptions logger - target spine server ${targetSpineServer}`)

  // nhsd-nhslogin-user looks like P9:9912003071
  const nhsNumber = event.headers["nhsd-nhslogin-user"]?.split(":")[1]
  logger.info(`nhsNumber: ${nhsNumber}`)
  logger.info(`SpinePrivateKey ${spinePrivateKey}`)
  logger.info(`spinePublicCertificate ${spinePublicCertificate}`)
  logger.info(`spineASIDARN ${spineASIDARN}`)

  const returnType = event.queryStringParameters?.returnType
  logger.info({message: "value of returnType", returnType})
  switch (returnType) {
    case "teapot": {
      return {
        statusCode: 418,
        body: JSON.stringify({
          message: "I am a teapot short and stout"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
    }
    case "error": {
      throw Error("error running lambda")
    }
    default: {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "hello world from getMyPrescriptions lambda"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
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
