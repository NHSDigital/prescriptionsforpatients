import {Bundle, MedicationRequest} from "fhir/r4"
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

    const hasApprovedOrCancelledStatus = (medicationRequest: MedicationRequest) => {
      const valueCodingCode = medicationRequest.extension?.[0]?.extension?.[0]?.valueCoding?.code
      return valueCodingCode === "Prescriber Approved" || valueCodingCode === "Cancelled"
    }
    const allItemsApprovedOrCancelled = medicationRequests.every(hasApprovedOrCancelledStatus)

    const prescriptionID = medicationRequests[0].groupIdentifier!.value!
    logger.info(`Building status update data for prescription ${prescriptionID}.`)

    const performerReference = isolatePerformerReference(medicationRequests)
    if (performerReference) {
      if (!allItemsApprovedOrCancelled) {
        const performer = isolatePerformerOrganisation(performerReference, prescription)
        const odsCode = performer.identifier![0].value!
        logger.info(
          `Performer organisation ${odsCode} found for prescription ${prescriptionID}.` +
          ` Adding to status update data.`
        )
        logger.info(
          `Not all items for prescription ${prescriptionID} are 'Prescriber Approved' or 'Cancelled'.`
        )
        statusUpdateData.push({odsCode: odsCode, prescriptionID: prescriptionID})
      } else {
        logger.info(
          `All items for prescription ${prescriptionID} are 'Prescriber Approved' or 'Cancelled'.`
        )
      }
    } else {
      logger.info(
        `No performer organisation found for for prescription ${prescriptionID}.`
      )
    }
  })

  return statusUpdateData
}
