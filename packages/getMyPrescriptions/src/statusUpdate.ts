import {Logger} from "@aws-lambda-powertools/logger"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import {Entry} from "@prescriptionsforpatients/distanceSelling"
import {Bundle, MedicationRequest, Organization} from "fhir/r4"

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
export type StatusUpdateData = {odsCode: string, prescriptionID: string}

export function buildStatusUpdateData(searchsetBundle: Bundle): Array<StatusUpdateData> {
  const statusUpdateData: Array<StatusUpdateData> = []
  isolatePrescriptions(searchsetBundle).forEach(prescription => {
    const medicationRequests = isolateMedicationRequests(prescription)
    const performerReference = isolatePerformerReference(medicationRequests)
    if (performerReference) {
      const performer = isolatePerformerOrganisation(performerReference, prescription)
      const odsCode = performer.identifier![0].value!
      const prescriptionID = medicationRequests[0].groupIdentifier!.value!
      logger.info(`Adding status update data for prescription ${prescriptionID}`)

      statusUpdateData.push({odsCode: odsCode, prescriptionID: prescriptionID})
    }
  })
  return statusUpdateData
}

function isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
  const filter = (entry: Entry) => entry.resource?.resourceType === "Bundle"
  return filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
}

function isolateMedicationRequests(prescription: Bundle): Array<MedicationRequest> {
  const filter = (entry: Entry) => entry.resource!.resourceType === "MedicationRequest"
  return filterAndTypeBundleEntries<MedicationRequest>(prescription, filter)
}

function isolatePerformerReference(medicationRequests: Array<MedicationRequest>): string | undefined {
  for (const medicationRequest of medicationRequests) {
    const reference = medicationRequest.dispenseRequest?.performer?.reference
    if (reference !== undefined) {
      return reference
    }
  }
}

function isolatePerformerOrganisation(reference: string, prescription: Bundle): Organization {
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
