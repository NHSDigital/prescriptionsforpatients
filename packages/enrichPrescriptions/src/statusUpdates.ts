import {Bundle, Extension, MedicationRequest} from "fhir/r4"

import {isolateMedicationRequests, isolatePrescriptions} from "./fhirUtils"
import {logger} from "./enrichPrescriptions"

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const DEFAULT_EXTENSION_STATUS = "With Pharmacy"
export const NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS = "With Pharmacy but Tracking not Supported"
export const VALUE_CODING_SYSTEM = "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"

type UpdateItem = {
  isTerminalState: string
  itemId: string
  lastUpdateDateTime: string
  latestStatus: string
}

type StatusUpdate = {
  onboarded: boolean
  prescriptionID: string
  items: Array<UpdateItem>
}

export type StatusUpdates = {
  isSuccess: boolean
  prescriptions: Array<StatusUpdate>
  schemaVersion: number
}

function defaultUpdate(onboarded: boolean = true): UpdateItem {
  return {
    isTerminalState: "false",
    latestStatus: onboarded ? DEFAULT_EXTENSION_STATUS : NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS,
    lastUpdateDateTime: new Date().toISOString(),
    itemId: ""
  }
}

function updateMedicationRequest(medicationRequest: MedicationRequest, updateItem: UpdateItem) {
  const status = updateItem.isTerminalState.toLowerCase() === "true" ? "completed" : "active"

  if (
    medicationRequest.extension?.[0]?.extension?.[0]?.valueCoding?.code &&
    (medicationRequest.extension[0].extension[0].valueCoding.code === "Prescriber Approved" ||
      medicationRequest.extension[0].extension[0].valueCoding.code === "Cancelled")
  ) {
    logger.info(
      `Status update for prescription ${updateItem.itemId} has been skipped because the current status is already ` +
      `${medicationRequest.extension[0].extension[0].valueCoding.code}.`
    )
    return
  }

  medicationRequest.status = status

  const extensionStatus = updateItem.latestStatus
  const extensionDateTime = updateItem.lastUpdateDateTime

  const extension: Extension = {
    url: EXTENSION_URL,
    extension: [
      {
        url: "status",
        valueCoding: {
          system: VALUE_CODING_SYSTEM,
          code: extensionStatus
        }
      },
      {
        url: "statusDate",
        valueDateTime: extensionDateTime
      }
    ]
  }

  if (medicationRequest.extension) {
    medicationRequest.extension.push(extension)
  } else {
    medicationRequest.extension = [extension]
  }
}

export function applyStatusUpdates(searchsetBundle: Bundle, statusUpdates: StatusUpdates) {
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const prescriptionID = medicationRequests![0].groupIdentifier!.value

    const hasPerformer = medicationRequests!.some(
      medicationRequest => medicationRequest.dispenseRequest?.performer?.reference
    )
    if (!hasPerformer) {
      logger.info(`Prescription ${prescriptionID} has no performer element. Skipping.`)
      return
    }

    logger.info(`Applying updates for prescription ${prescriptionID}.`)

    const prescriptionUpdate = statusUpdates.prescriptions.filter(p => p.prescriptionID === prescriptionID)[0]
    if (!prescriptionUpdate || !prescriptionUpdate.onboarded) {
      logger.info(`Supplier of prescription ${prescriptionID} not onboarded. Applying default updates.`)
      medicationRequests?.forEach(medicationRequest =>
        updateMedicationRequest(medicationRequest, defaultUpdate(false))
      )
      return
    }

    medicationRequests?.forEach(medicationRequest => {
      const medicationRequestID = medicationRequest.identifier?.[0].value
      logger.info(`Updating MedicationRequest with id ${medicationRequestID}`)

      const itemUpdates = prescriptionUpdate.items.filter(item => item.itemId === medicationRequestID)
      if (itemUpdates.length > 0) {
        logger.info(`Update found for MedicationRequest with id ${medicationRequestID}. Applying.`)
        updateMedicationRequest(medicationRequest, itemUpdates[0])
      } else {
        logger.info(`No update found for MedicationRequest with id ${medicationRequestID}. Applying default.`)
        updateMedicationRequest(medicationRequest, defaultUpdate())
      }
    })
  })
}
