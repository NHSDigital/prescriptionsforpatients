import {Logger} from "@aws-lambda-powertools/logger"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {LogLevel} from "@aws-lambda-powertools/logger/types"

import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import {Bundle} from "fhir/r4"

import {
  StatusUpdateRequest,
  StatusUpdates,
  UpdatesScenario,
  applyStatusUpdates,
  applyTemporaryStatusUpdates,
  getUpdatesScenario
} from "./statusUpdates"
import {TraceIDs, lambdaResponse} from "./responses"
import {extractNHSNumber} from "./fhirUtils"

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

  const nhsNumber = extractNHSNumber(logger, searchsetBundle)
  logger.info("NHS number", {nhsNumber: `${nhsNumber}`})

  const statusUpdates = event.StatusUpdates?.Payload
  const updatesScenario = getUpdatesScenario(logger, statusUpdates, nhsNumber)

  switch (updatesScenario) {
    case UpdatesScenario.Present: {
      logger.info("Applying status updates.")
      applyStatusUpdates(logger, searchsetBundle, statusUpdates!)
      break
    }
    case UpdatesScenario.ExpectedButAbsent: {
      logger.info("Call to get status updates was unsuccessful. Applying temporary status updates.")
      applyTemporaryStatusUpdates(logger, searchsetBundle, event.statusUpdateData)
      break
    }
    default: {
      logger.info("Get Status Updates is toggled-off. No status updates to apply.")
    }
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
