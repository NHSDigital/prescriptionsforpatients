import {Bundle} from "fhir/r4"
import {
  isolateMedicationRequests,
  isolatePerformerOrganisation,
  isolatePerformerReference,
  isolatePrescriptions
} from "./fhirUtils"
import {logger} from "./getMyPrescriptions"

export type StatusUpdateData = {odsCode: string, prescriptionID: string}

export const shouldGetStatusUpdates = () => process.env.GET_STATUS_UPDATES === "true"

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
