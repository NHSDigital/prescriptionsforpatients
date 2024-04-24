import {Logger} from "@aws-lambda-powertools/logger"
import {
  Bundle,
  BundleEntry,
  Extension,
  FhirResource,
  MedicationRequest
} from "fhir/r4"

import {LOG_LEVEL} from "./enrichPrescriptions"

export type Entry = BundleEntry<FhirResource>

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const DEFAULT_EXTENSION_STATUS = "With Pharmacy but Tracking not Supported"
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

function isolateMedicationRequests(prescriptions: Array<Bundle>): Array<MedicationRequest> | undefined {
  return prescriptions?.flatMap(resource => resource.entry)
    .filter(entry => entry?.resource?.resourceType === "MedicationRequest")
    .map(entry => entry?.resource as MedicationRequest)
}

function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

function updateMedicationRequest(medicationRequest: MedicationRequest, updateItem?: UpdateItem) {
  const status = updateItem?.isTerminalState.toLowerCase() === "true" ? "completed" : "active"
  medicationRequest.status = status

  const extensionStatus = updateItem?.latestStatus ?? DEFAULT_EXTENSION_STATUS
  const extensionDateTime = updateItem?.lastUpdateDateTime ?? new Date().toISOString()

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
  if (statusUpdates.isSuccess) {
    const prescriptions = isolatePrescriptions(searchsetBundle)
    const medicationRequests = isolateMedicationRequests(prescriptions)

    medicationRequests?.forEach(medicationRequest => {
      const medicationRequestId = medicationRequest.identifier?.[0].value
      logger.info(`Updating MedicationRequest with id ${medicationRequestId}`)

      const matchingUpdateItems = statusUpdates.prescriptions
        .flatMap(prescription => prescription.items)
        .filter(items => items.itemId === medicationRequestId)

      if (matchingUpdateItems.length > 0) {
        logger.info(`Update found for MedicationRequest with id ${medicationRequestId}. Applying.`)
        updateMedicationRequest(medicationRequest, matchingUpdateItems[0])
      } else {
        logger.info(`No update found for MedicationRequest with id ${medicationRequestId}. Applying default.`)
        updateMedicationRequest(medicationRequest)
      }
    })
  } else {
    logger.info("Status updates flagged as unsuccessful. Skipping.")
  }
}

function filterAndTypeBundleEntries<T>(bundle: Bundle, filter: (entry: Entry) => boolean): Array<T> {
  const entries = bundle.entry
  if (entries) {
    return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
  } else {
    return []
  }
}
