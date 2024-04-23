import {Logger} from "@aws-lambda-powertools/logger"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import {Bundle} from "fhir/r4"
import {
  isolateMedicationRequests,
  isolatePerformerOrganisation,
  isolatePerformerReference,
  isolatePrescriptions
} from "./fhirUtils"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
export type StatusUpdateData = {odsCode: string, prescriptionID: string}

export function buildStatusUpdateData(searchsetBundle: Bundle): Array<StatusUpdateData> {
  const statusUpdateData: Array<StatusUpdateData> = []
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const prescriptionID = medicationRequests[0].groupIdentifier!.value!
    logger.info(`Building status update data for prescription ${prescriptionID}.`)

    const performerReference = isolatePerformerReference(medicationRequests)
    if (performerReference) {
      const performer = isolatePerformerOrganisation(performerReference, prescription)
      const odsCode = performer.identifier![0].value!
      logger.info(
        `Performer organisation ${odsCode} found for for prescription ${prescriptionID}. Adding to status update data.`
      )

      statusUpdateData.push({odsCode: odsCode, prescriptionID: prescriptionID})
    } else {
      logger.info(
        `No performer organisation found for for prescription ${prescriptionID}.`
      )
    }
  })

  return statusUpdateData
}
