import {
  Bundle,
  BundleEntry,
  FhirResource,
  MedicationRequest,
  OperationOutcome,
  Organization
} from "fhir/r4"

export type Entry = BundleEntry<FhirResource>
export type StatusUpdateData = {odsCode: string; prescriptionID: string}

// This function is to be used when splitting-out DistanceSelling to run in parallel with the call to GetStatusUpdates.
// The data given to DistanceSelling can be kept simple and built using this common fhirUtils code.
// The output of this function can be passed straight into DistanceSelling.processOdsCodes.
export function isolatePerformerOrganisations(searchsetBundle: Bundle): Array<Organization> {
  const performerOrganisations: Array<Organization> = []
  isolatePrescriptions(searchsetBundle).forEach((prescription) => {
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

export function filterAndTypeBundleEntries<T>(bundle: Bundle, filter: (entry: Entry) => boolean): Array<T> {
  const entries = bundle.entry
  if (entries) {
    return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
  } else {
    return []
  }
}

export function isolateOperationOutcome(prescription: Bundle): Array<OperationOutcome> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "OperationOutcome"
  return filterAndTypeBundleEntries<OperationOutcome>(prescription, filter)
}
