import {
  Bundle,
  BundleEntry,
  FhirResource,
  MedicationRequest,
  Organization
} from "fhir/r4"

import {Logger} from "@aws-lambda-powertools/logger"

export type Entry = BundleEntry<FhirResource>

type UpdateItem = {
  isTerminalState: string
  itemId: string
  lastUpdateDateTime: string
  latestStatus: string
  postDatedLastModifiedSetAt?: string
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

export function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

export function isolateMedicationRequests(prescription: Bundle): Array<MedicationRequest> | undefined {
  return prescription.entry
    ?.filter((entry) => entry?.resource?.resourceType === "MedicationRequest")
    .map((entry) => entry?.resource as MedicationRequest)
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
  const filter = (entry: Entry) => (!!entry.fullUrl && entry.fullUrl === reference)
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

export function extractNHSNumber(logger: Logger, searchsetBundle: Bundle<FhirResource>): string {

  let nhsNumber = ""
  logger.debug("Extracting nhs number from this fhir bundle", {searchsetBundle})
  for (const prescription of isolatePrescriptions(searchsetBundle)) {
    const medicationRequests = isolateMedicationRequests(prescription)

    if (!medicationRequests?.length) {
      continue
    }

    // Find the NHS number identifier on the subject of each MedicationRequest
    const nhsIdentifier = medicationRequests
      .map((med) => med.subject?.identifier)
      .find(
        (id) =>
          id?.system === "https://fhir.nhs.uk/Id/nhs-number" && typeof id.value === "string"
      )
    logger.debug("Found NHS number", {nhsIdentifier})

    if (nhsIdentifier?.value) {
      // If there are multiple NHS numbers in the bundle, and they DON'T match up, we can't say which is correct.
      // So, don't say anything.
      // This shouldn't happen though - it's against the spec - but I'm putting a catch in just in case.
      if ((nhsNumber !== "") && (nhsNumber !== nhsIdentifier.value)) {
        logger.warn("Multiple NHS numbers found in the FHIR bundle. Returning no NHS number.")
        return ""
      }
      nhsNumber = nhsIdentifier.value
    }

  }
  return nhsNumber
}
