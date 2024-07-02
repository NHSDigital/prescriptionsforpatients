import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {Bundle} from "fhir/r4"
import {
  StatusUpdateRequest,
  StatusUpdates,
  applyStatusUpdates,
  applyTemporaryStatusUpdates
} from "./statusUpdates"
import {TraceIDs, lambdaResponse} from "./responses"

export const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
export const logger = new Logger({serviceName: "enrichPrescriptions", logLevel: LOG_LEVEL})

export type EnrichPrescriptionsEvent = {
  fhir: Bundle
  statusUpdateData: StatusUpdateRequest
  StatusUpdates?: {Payload: StatusUpdates}
  traceIDs: TraceIDs
}

export async function lambdaHandler(event: EnrichPrescriptionsEvent) {
  const traceIDs = {
    "apigw-request-id": event.traceIDs["apigw-request-id"],
    "nhsd-correlation-id": event.traceIDs["nhsd-correlation-id"],
    "nhsd-request-id": event.traceIDs["nhsd-request-id"],
    "x-correlation-id": event.traceIDs["x-correlation-id"],
    "x-request-id": event.traceIDs["x-request-id"]
  }
  logger.appendKeys(traceIDs)

  const searchsetBundle = event.fhir
  const statusUpdates = event.StatusUpdates?.Payload

  if (statusUpdates && statusUpdates.isSuccess) {
    logger.info("Applying status updates.")
    applyStatusUpdates(searchsetBundle, statusUpdates)
  } else if (statusUpdates && !statusUpdates.isSuccess) {
    logger.info("Call to get status updates was unsuccessful. Applying temporary status updates.")
    const statusUpdateRequest = event.statusUpdateData!
    applyTemporaryStatusUpdates(searchsetBundle, statusUpdateRequest)
  } else {
    logger.info("No status updates to apply.")
  }

  return lambdaResponse(200, searchsetBundle, event.traceIDs)
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
