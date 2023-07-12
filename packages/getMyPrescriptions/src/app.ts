import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {getSecret} from "@aws-lambda-powertools/parameters/secrets"
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
  let spinePrivateKey: string | undefined
  let spinePublicCertificate: string | undefined
  let spineASID: string | undefined
  let spineCAChain: string | undefined
  /**
   * These should be outside the handler so are called less times
   * See https://matty.dev/blog/2023-01-26-hidden-sam-cli-features for one way to do this
   * But this fails as it cant use crypto
   * See https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694 for a solution to this
   * But this cant be used due to serverless-esbuild not supporting esbuild 0.18
   * See https://github.com/floydspace/serverless-esbuild/issues/470
   *
   * Another solution may be https://aws.amazon.com/blogs/compute/creating-aws-lambda-environmental-variables-from-aws-secrets-manager/
   */
  if (process.env.SpinePrivateKeyARN !== undefined) {
    spinePrivateKey = await getSecret(process.env.SpinePrivateKeyARN)
  }
  if (process.env.SpinePublicCertificateARN !== undefined) {
    spinePublicCertificate = await getSecret(process.env.SpinePublicCertificateARN)
  }
  if (process.env.SpineASIDARN !== undefined) {
    spineASID = await getSecret(process.env.SpineASIDARN)
  }
  if (process.env.SpineCAChainARN !== undefined) {
    spineCAChain = await getSecret(process.env.SpineCAChainARN)
  }

  // nhsd-nhslogin-user looks like P9:9912003071
  const nhsNumber = event.headers["nhsd-nhslogin-user"]?.split(":")[1]
  logger.info(`nhsNumber: ${nhsNumber}`)

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const spineClient = createSpineClient(spinePrivateKey, spinePublicCertificate, spineASID, spineCAChain)

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
