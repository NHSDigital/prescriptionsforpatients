import {Bundle, Extension, MedicationRequest} from "fhir/r4"
import moment, {Moment} from "moment"
import {
  isolateMedicationRequests,
  isolatePerformerOrganisation,
  isolatePerformerReference,
  isolatePrescriptions
} from "./fhirUtils"
import {logger} from "./enrichPrescriptions"

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const VALUE_CODING_SYSTEM = "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"
export const ONE_WEEK_IN_MS = 604800000

export const DEFAULT_EXTENSION_STATUS = "With Pharmacy"
export const NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS = "With Pharmacy but Tracking not Supported"
export const TEMPORARILY_UNAVAILABLE_STATUS = "Tracking Temporarily Unavailable"
export const APPROVED_STATUS = "Prescriber Approved"
export const CANCELLED_STATUS = "Prescriber Cancelled"

type MedicationRequestStatus = "completed" | "active"

type UpdateItem = {
  isTerminalState: boolean
  itemId?: string
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

export type Prescription = {
  odsCode: string
  prescriptionID: string
}

export type StatusUpdateRequest = {
  schemaVersion: number
  prescriptions: Array<Prescription>
}

function defaultUpdate(onboarded: boolean = true): UpdateItem {
  return {
    isTerminalState: false,
    latestStatus: onboarded ? DEFAULT_EXTENSION_STATUS : NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS,
    lastUpdateDateTime: moment().utc().toISOString()
  }
}

function determineStatus(updateItem: UpdateItem): MedicationRequestStatus {
  if (!updateItem.isTerminalState === true) {
    return "active"
  }

  const lastUpdateDateTime = moment(updateItem.lastUpdateDateTime).utc().valueOf()
  const now = moment().utc().valueOf()
  const updatedOverSevenDaysAgo = now - lastUpdateDateTime > ONE_WEEK_IN_MS

  return updatedOverSevenDaysAgo ? "completed" : "active"
}

function updateMedicationRequest(medicationRequest: MedicationRequest, updateItem: UpdateItem) {
  const status = determineStatus(updateItem)
  const relevantExtension = medicationRequest.extension?.find((ext) => ext.url === EXTENSION_URL)
  const statusCoding = relevantExtension?.extension?.find((innerExt) => innerExt.url === "status")?.valueCoding?.code

  if (statusCoding && (statusCoding === APPROVED_STATUS || statusCoding === CANCELLED_STATUS)) {
    logger.info(
      `Status update for prescription ${updateItem.itemId} has been skipped because the current status is already ` +
        `${statusCoding}.`
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

  // Add extension if non present
  if (!medicationRequest.extension) {
    medicationRequest.extension = [extension]
    return
  }

  // Replace 'With Pharmacy but Tracking not Supported' status update extension if present, push otherwise
  const replacementIndex = statusHistoryExtensionReplacementIndex(medicationRequest)
  if (replacementIndex !== -1) {
    medicationRequest.extension[replacementIndex] = extension
  } else {
    medicationRequest.extension.push(extension)
  }
}

function statusHistoryExtensionReplacementIndex(medicationRequest: MedicationRequest): number {
  const extensions = medicationRequest.extension || []
  return extensions.findIndex((extension) => {
    if (extension.url !== EXTENSION_URL) {
      return false
    }

    const status_extension = extension.extension?.find((ext) => ext.url === "status")
    const status = status_extension?.valueCoding?.code

    return status === NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS
  })
}

export function applyStatusUpdates(searchsetBundle: Bundle, statusUpdates: StatusUpdates) {
  isolatePrescriptions(searchsetBundle).forEach((prescription) => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const prescriptionID = medicationRequests![0].groupIdentifier!.value!.toUpperCase()

    const hasPerformer = medicationRequests!.some(
      (medicationRequest) => medicationRequest.dispenseRequest?.performer?.reference
    )
    if (!hasPerformer) {
      logger.info(`Prescription ${prescriptionID} has no performer element. Skipping.`)
      return
    }

    logger.info(`Applying updates for prescription ${prescriptionID}.`)

    const prescriptionUpdate = statusUpdates.prescriptions.filter((p) => p.prescriptionID === prescriptionID)[0]
    if (!prescriptionUpdate || !prescriptionUpdate.onboarded) {
      logger.info(`Supplier of prescription ${prescriptionID} not onboarded. Applying default updates.`)
      medicationRequests?.forEach((medicationRequest) => {
        if (delayWithPharmacyStatus(medicationRequest)) {
          const lineItemId = medicationRequest.identifier?.find(
            (identifier) => identifier.system === "https://fhir.nhs.uk/Id/prescription-order-item-number"
          )?.value
          logger.info(
            `Delaying 'With Pharmacy but Tracking not Supported' status ` +
              `for prescription ${prescriptionID} line item id ${lineItemId}`
          )
          // Prescription has been in "With Pharmacy but Tracking not Supported" status for less than an hour,
          // set status as Prescriber Approved
          const update: UpdateItem = {
            isTerminalState: false,
            lastUpdateDateTime: moment().utc().toISOString(),
            latestStatus: APPROVED_STATUS
          }
          updateMedicationRequest(medicationRequest, update)
          return
        }
        updateMedicationRequest(medicationRequest, defaultUpdate(false))
      })
      return
    }

    medicationRequests?.forEach((medicationRequest) => {
      const medicationRequestID = medicationRequest.identifier?.[0].value?.toUpperCase()
      logger.info(`Updating MedicationRequest with id ${medicationRequestID}`)

      const itemUpdates = prescriptionUpdate.items.filter((item) => item.itemId === medicationRequestID)
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

export function delayWithPharmacyStatus(medicationRequest: MedicationRequest): boolean {
  const statusExtension = getStatusHistoryExtension(medicationRequest)
  if (!statusExtension) {
    return false
  }

  const updateTime = getStatusDate(statusExtension)?.valueOf()
  const status = getStatus(statusExtension)

  if (!updateTime || !status || status !== "With Pharmacy but Tracking not Supported") {
    return false
  }

  const now = moment().utc().valueOf()
  const sixtyMinutes = 60 * 60 * 1000

  return now - updateTime < sixtyMinutes
}

function getStatusHistoryExtension(medicationRequest: MedicationRequest): Extension | undefined {
  const STATUS_HISTORY_EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
  return medicationRequest.extension?.find((extension) => extension.url === STATUS_HISTORY_EXTENSION_URL)
}

export function getStatusDate(statusExtension: Extension): Moment | undefined {
  const dateTime = statusExtension.extension?.find((extension) => extension?.url === "statusDate")?.valueDateTime

  return dateTime ? moment(dateTime).utc() : undefined
}

function getStatus(statusExtension: Extension): string | undefined {
  const VALUE_CODING_SYSTEM = "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"

  return statusExtension.extension
    ?.filter((extension) => extension.url === "status")
    .map((extension) => extension.valueCoding)
    .filter((coding) => coding?.system === VALUE_CODING_SYSTEM)
    .map((coding) => coding?.code)
    .pop()
}

export function applyTemporaryStatusUpdates(searchsetBundle: Bundle, statusUpdateRequest: StatusUpdateRequest) {
  const update: UpdateItem = {
    isTerminalState: false,
    lastUpdateDateTime: moment().utc().toISOString(),
    latestStatus: TEMPORARILY_UNAVAILABLE_STATUS
  }
  isolatePrescriptions(searchsetBundle).forEach((prescription) => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const prescriptionID = medicationRequests![0].groupIdentifier!.value!.toUpperCase()

    const performerReference = isolatePerformerReference(medicationRequests!)
    if (performerReference) {
      const performer = isolatePerformerOrganisation(performerReference, prescription)
      const odsCode = performer.identifier![0].value!.toUpperCase()

      const updates = statusUpdateRequest.prescriptions.filter(
        (data) => data.prescriptionID.toUpperCase() === prescriptionID && data.odsCode.toUpperCase() === odsCode
      )
      if (updates.length > 0) {
        logger.info(`Updates expected for medication requests in prescription ${prescriptionID}. Applying temporary.`)
        medicationRequests?.forEach((medicationRequest) => updateMedicationRequest(medicationRequest, update))
      }
    }
  })
}
