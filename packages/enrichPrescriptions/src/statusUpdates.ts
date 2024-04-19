import {
  Bundle,
  BundleEntry,
  Extension,
  MedicationRequest
} from "fhir/r4"

export const EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const DEFAULT_EXTENSION_STATUS = "With Pharmacy but Tracking not Supported"
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

export function isolateMedicationRequests(searchsetBundle: Bundle): Array<MedicationRequest> | undefined {
  const collectionBundleEntries: Array<BundleEntry> | undefined = searchsetBundle.entry
  const collectionBundleResources: Array<Bundle> | undefined = collectionBundleEntries?.map(
    entry => entry.resource as Bundle
  )

  return collectionBundleResources?.flatMap(
    resource => resource.entry
  ).filter(
    entry => entry?.resource?.resourceType === "MedicationRequest"
  ).map(
    entry => entry?.resource as MedicationRequest
  )
}

export function updateMedicationRequest(medicationRequest: MedicationRequest, updateItem?: UpdateItem) {
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
    const medicationRequests = isolateMedicationRequests(searchsetBundle)

    medicationRequests?.forEach(medicationRequest => {
      const matchingUpdateItems = statusUpdates.prescriptions.flatMap(
        prescription => prescription.items
      ).filter(
        items => items.itemId === medicationRequest.id
      )

      if (matchingUpdateItems.length > 0) {
        updateMedicationRequest(medicationRequest, matchingUpdateItems[0])
      } else {
        updateMedicationRequest(medicationRequest)
      }
    })
  }
}
