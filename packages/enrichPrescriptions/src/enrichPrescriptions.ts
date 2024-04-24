import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {Bundle} from "fhir/r4"
import {StatusUpdates, applyStatusUpdates} from "./statusUpdates"
import {lambdaResponse} from "./responses"

export const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "enrichPrescriptions", logLevel: LOG_LEVEL})

export type EnrichPrescriptionsEvent = {
  Payload: {body: {fhir: Bundle}},
  StatusUpdates?: {Payload: StatusUpdates}
}

export async function lambdaHandler(event: EnrichPrescriptionsEvent) {
  const searchsetBundle = event.Payload.body.fhir
  const statusUpdates = event.StatusUpdates?.Payload

  if (statusUpdates) {
    logger.info("Applying status updates.")
    applyStatusUpdates(searchsetBundle, statusUpdates)
  } else {
    logger.info("No status updates to apply.")
  }

  return lambdaResponse(200, searchsetBundle)
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
