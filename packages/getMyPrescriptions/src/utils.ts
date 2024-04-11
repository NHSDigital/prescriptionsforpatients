import {Entry} from "@prescriptionsforpatients/distanceSelling"
import {Bundle, MedicationRequest, Organization} from "fhir/r4"

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export interface Timeout {
  isTimeout: true
}
export async function jobWithTimeout<T>(timeoutMS: number, job: Promise<T>): Promise<T | Timeout> {
  const timeoutPromise: Promise<Timeout> = new Promise((resolve) => {
    setTimeout(() => {
      resolve({isTimeout: true})
    }, timeoutMS)
  })
  return Promise.race([job, timeoutPromise])
}

export function hasTimedOut<T>(response: T | Timeout): response is Timeout{
  return !!(response as Timeout)?.isTimeout
}

export function buildStatusUpdateData(
  searchsetBundle: Bundle
): Array<{odsCode: string, prescriptionID: string}> {
  return isolatePrescriptions(searchsetBundle).map(prescription => {
    const medicationRequest = isolateMedicationRequests(prescription)[0]
    const performerReference = medicationRequest.dispenseRequest!.performer!.reference!
    const prescriptionID = medicationRequest.groupIdentifier!.value!
    const odsCode = getPerformerOdsCode(performerReference, prescription)

    return {odsCode: odsCode, prescriptionID: prescriptionID}
  })
}

function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource!.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

function isolateMedicationRequests(prescription: Bundle): Array<MedicationRequest> {
  const filter = (entry: Entry) => entry.resource!.resourceType === "MedicationRequest"
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
