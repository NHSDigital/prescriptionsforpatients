import {Entry} from "@prescriptionsforpatients/distanceSelling"
import {Bundle, MedicationRequest, Organization} from "fhir/r4"

export type StatusUpdateData = {odsCode: string, prescriptionID: string}

export function buildStatusUpdateData(searchsetBundle: Bundle): Array<StatusUpdateData> {
  const statusUpdateData: Array<StatusUpdateData> = []
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequestsWithPerformer(prescription)
    if (medicationRequests.length > 0) {
      const performerReference = medicationRequests[0].dispenseRequest!.performer!.reference!
      const prescriptionID = medicationRequests[0].groupIdentifier!.value!
      const odsCode = getPerformerOdsCode(performerReference, prescription)

      statusUpdateData.push({odsCode: odsCode, prescriptionID: prescriptionID})
    }
  })
  return statusUpdateData
}

function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

function isolateMedicationRequestsWithPerformer(prescription: Bundle): Array<MedicationRequest> {
  const filter = (entry: Entry) =>
    entry.resource!.resourceType === "MedicationRequest" &&
    entry.resource.dispenseRequest?.performer?.reference !== undefined
  return filterAndTypeBundleEntries<MedicationRequest>(prescription, filter)
}

function getPerformerOdsCode(reference: string, prescription: Bundle): string {
  const filter = (entry: Entry) => entry.fullUrl! === reference
  return filterAndTypeBundleEntries<Organization>(prescription, filter)[0].identifier![0].value!
}

function filterAndTypeBundleEntries<T>(bundle: Bundle, filter: (entry: Entry) => boolean): Array<T> {
  const entries = bundle.entry
  if (entries) {
    return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
  } else {
    return []
  }
}
