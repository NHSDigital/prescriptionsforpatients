import {Logger} from "@aws-lambda-powertools/logger"
import {Bundle, Extension, MedicationRequest} from "fhir/r4"

import {LOG_LEVEL} from "./enrichPrescriptions"
import {isolateMedicationRequests, isolatePrescriptions} from "./fhirUtils"

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const DEFAULT_EXTENSION_STATUS = "With Pharmacy but Tracking not Supported"
export const NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS = "With Pharmacy"
export const VALUE_CODING_SYSTEM = "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"

const logger = new Logger({serviceName: "statusUpdates", logLevel: LOG_LEVEL})

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
    medicationRequest.extension.push()
  } else {
    medicationRequest.extension = [extension]
  }
}

export function applyStatusUpdates(searchsetBundle: Bundle, statusUpdates: StatusUpdates) {
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const prescriptionID = medicationRequests![0].groupIdentifier!.value
    logger.info(`Applying updates for prescription ${prescriptionID}`)

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
