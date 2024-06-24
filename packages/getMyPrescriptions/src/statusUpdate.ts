import {Bundle, MedicationRequest} from "fhir/r4"
import {
  isolateMedicationRequests,
  isolatePerformerOrganisation,
  isolatePerformerReference,
  isolatePrescriptions
} from "./fhirUtils"
import {logger} from "./getMyPrescriptions"

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const shouldGetStatusUpdates = () => process.env.GET_STATUS_UPDATES === "true"

export type StatusUpdateData = {odsCode: string; prescriptionID: string}

export function buildStatusUpdateData(searchsetBundle: Bundle): Array<StatusUpdateData> {
  const statusUpdateData: Array<StatusUpdateData> = []
  isolatePrescriptions(searchsetBundle).forEach((prescription) => {
    const medicationRequests = isolateMedicationRequests(prescription)

    const hasApprovedOrCancelledStatus = (medicationRequest: MedicationRequest) => {
      const relevantExtension = medicationRequest.extension?.find((ext) => ext.url === EXTENSION_URL)
      const statusExtension = relevantExtension?.extension?.find((innerExt) => innerExt.url === "status")
      const valueCodingCode = statusExtension?.valueCoding?.code
      return valueCodingCode === "Prescriber Approved" || valueCodingCode === "Prescriber Cancelled"
    }

    const allItemsApprovedOrCancelled = medicationRequests.every(hasApprovedOrCancelledStatus)

    const prescriptionID = medicationRequests[0].groupIdentifier!.value!
    logger.info(`Building status update data for prescription ${prescriptionID}.`)

    if (allItemsApprovedOrCancelled) {
      logger.info(`All items for prescription ${prescriptionID} are 'Prescriber Approved' or 'Cancelled'.`)
      logger.info(`Ignoring prescription.`)
      return
    }

    const performerReference = isolatePerformerReference(medicationRequests)
    if (performerReference) {
      const performer = isolatePerformerOrganisation(performerReference, prescription)
      const odsCode = performer.identifier![0].value!
      logger.info(
        `Performer organisation ${odsCode} found for prescription ${prescriptionID}. Adding to status update data.`
      )
      statusUpdateData.push({odsCode: odsCode, prescriptionID: prescriptionID})
    } else {
      logger.info(`No performer organisation found for prescription ${prescriptionID}.`)
    }
  })

  return statusUpdateData
}
