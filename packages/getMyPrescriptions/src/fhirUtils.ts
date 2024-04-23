import {Entry} from "@prescriptionsforpatients/distanceSelling"
import {Bundle, MedicationRequest, Organization} from "fhir/r4"

export type StatusUpdateData = {odsCode: string, prescriptionID: string}

export function isolatePerformerOrganisations(searchsetBundle: Bundle): Array<Organization> {
  const performerOrganisations: Array<Organization> = []
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const performerReference = isolatePerformerReference(medicationRequests)
    if (performerReference) {
      performerOrganisations.push(isolatePerformerOrganisation(performerReference, prescription))
    }
  })
  return performerOrganisations
}

export function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

export function isolateMedicationRequests(prescription: Bundle): Array<MedicationRequest> {
  const filter = (entry: Entry) => entry.resource!.resourceType === "MedicationRequest"
  return filterAndTypeBundleEntries<MedicationRequest>(prescription, filter)
}

export function isolatePerformerReference(medicationRequests: Array<MedicationRequest>): string | undefined {
  for (const medicationRequest of medicationRequests) {
    const reference = medicationRequest.dispenseRequest?.performer?.reference
    if (reference !== undefined) {
      return reference
    }
  }
}

export function isolatePerformerOrganisation(reference: string, prescription: Bundle): Organization {
  const filter = (entry: Entry) => entry.fullUrl! === reference
  return filterAndTypeBundleEntries<Organization>(prescription, filter)[0]
}

function filterAndTypeBundleEntries<T>(bundle: Bundle, filter: (entry: Entry) => boolean): Array<T> {
  const entries = bundle.entry
  if (entries) {
    return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
  } else {
    return []
  }
}
