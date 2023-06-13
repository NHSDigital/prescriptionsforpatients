import {APIGatewayProxyEvent, APIGatewayProxyResult, CloudFormationCustomResourceEvent} from "aws-lambda"
import {S3} from "aws-sdk"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@schibsted/middy-error-handler"

const logger = new Logger({serviceName: "authz"})
const s3Client = new S3

type responseType = {[key: string] : string | undefined}

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
const lambdaHandler = async (event: CloudFormationCustomResourceEvent) => {
  logger.info("hello world from authz logger")

  const requestType = event.RequestType
  const bucket = event.ResourceProperties.TrustStoreBucket  || "";
  const key = event.ResourceProperties.TrustStoreKey  || "";
  const concatenatedCert = event.ResourceProperties.Certs.join("\r\n") || "";
  const responseData: responseType= {}

  if (requestType==null || concatenatedCert == "") {
    throw Error
  }

  switch (requestType) {
    case "Create":
      logger.info({message:"CREATE"})
      const createPutObjectResponse = await s3Client
      .putObject({
        Bucket : bucket,
        Key : key,
        Body: concatenatedCert
      })
      .promise();
      logger.info(JSON.parse(JSON.stringify(createPutObjectResponse)))
      responseData.Message = "Resource creation successful!"
      responseData.TrustStoreUri = `s3://${bucket}/${key}`
      responseData.ObjectVersion = createPutObjectResponse.VersionId?.toString()


    case "Update":
      logger.info({message:"UPDATE"})
      const updatePutObjectResponse = await s3Client
      .putObject({
        Bucket : bucket,
        Key : key,
        Body: concatenatedCert
      })
      .promise();
      logger.info(JSON.parse(JSON.stringify(updatePutObjectResponse)))
      responseData.Message = "Resource update successful!"
      responseData.TrustStoreUri = `s3://${bucket}/${key}`
      responseData.ObjectVersion = updatePutObjectResponse.VersionId?.toString()
    case "Delete":
      logger.info({message:"DELETE"})
    default:  
      logger.info({message:"UNKNOWN REQUEST TYPE"})
  }

}

const sendResponse = async (event: CloudFormationCustomResourceEvent, responseStatus: string, responseData: responseType) => {
const responseUrl = event.ResponseURL
logger.info({message: "responseUrl", responseUrl})
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
