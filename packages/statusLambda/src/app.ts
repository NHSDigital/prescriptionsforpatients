import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@middleware/src"
import createSpineClient from "@spineClient/src"
import {getSecret} from "@aws-lambda-powertools/parameters/secrets"

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
const lambdaHandler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let spinePrivateKey: string | undefined
  let spinePublicCertificate: string | undefined
  let spineASID: string | undefined
  let spineCAChain: string | undefined
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

  const spineClient = createSpineClient.createSpineClient(
    spinePrivateKey,
    spinePublicCertificate,
    spineASID,
    spineCAChain
  )

  const spineStatus = await spineClient.getStatus(logger)

  const commitId = process.env.COMMIT_ID
  const versionNumber = process.env.VERSION_NUMBER

  return {
    statusCode: 200,
    body: JSON.stringify({
      commitId: commitId,
      versionNumber: versionNumber,
      spineStatus: spineStatus
    }),
    headers: {
      "Content-Type": "application/health+json"
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
