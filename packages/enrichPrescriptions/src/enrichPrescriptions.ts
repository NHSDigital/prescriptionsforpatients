import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {jobWithTimeout} from "./utils"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "enrichPrescriptions", logLevel: LOG_LEVEL})

const LAMBDA_TIMEOUT_MS = 10_000

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
const lambdaHandler = async () => {
  return jobWithTimeout(LAMBDA_TIMEOUT_MS, eventHandler())
}

export async function eventHandler() {
  return
}

export const handler = middy(lambdaHandler)
  .use(injectLambdaContext(logger, {clearState: true}))
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
