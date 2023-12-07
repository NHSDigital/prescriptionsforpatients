import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient, createServiceSearchClient} from "@prescriptionsforpatients/serviceSearchClient"
import {
  Bundle,
  BundleEntry,
  FhirResource,
  MedicationRequest,
  Organization
} from "fhir/r4"

type Entry = BundleEntry<FhirResource>

export class ServiceSearch {
  private readonly logger: Logger
  private readonly client: ServiceSearchClient
  private localServicesCache: Record<string, string>

  constructor() {
    this.logger = new Logger()
    this.client = createServiceSearchClient(this.logger)
    this.localServicesCache = {}
  }

  search(searchsetBundle: Bundle) {
    const prescriptions: Array<Bundle> = this.isolatePrescriptions(searchsetBundle)
    const performerReferences: Set<string> = this.getPerformerReferences(prescriptions)
    const odsCodes: Set<string> = this.getOdsCodes(performerReferences, prescriptions)
  }

  isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
    const filter = (entry: Entry) => entry.resource!.resourceType === "Bundle"
    return this.filterEntries<Bundle>(searchsetBundle.entry!, filter)
  }

  getPerformerReferences(prescriptions: Array<Bundle>): Set<string> {
    const medicationRequests = prescriptions.flatMap((prescription: Bundle) =>
      prescription.entry!.filter((entry: Entry) =>
        entry.resource!.resourceType === "MedicationRequest"
      ).map((entry) => entry.resource)
    ) as Array<MedicationRequest>

    const performerReferences: Set<string> = new Set<string>()
    medicationRequests.forEach((medicationRequest: MedicationRequest) => {
      const reference = medicationRequest.dispenseRequest?.performer?.reference
      if (reference) {
        performerReferences.add(reference)
      }
    })
    return performerReferences
  }

  getOdsCodes(performerReferences: Set<string>, prescriptions: Array<Bundle>): Set<string> {
    const organisations = prescriptions.flatMap((prescription: Bundle) =>
      prescription.entry!.filter((entry: Entry) =>
        performerReferences.has(entry.fullUrl!)
      ).map((entry) => entry.resource)
    ) as Array<Organization>

    const odsCodes: Set<string> = new Set<string>()
    organisations.forEach((organisation: Organization) => {
      const odsCode = organisation.identifier![0].value
      if (odsCode) {
        odsCodes.add(odsCode)
      }
    })
    return odsCodes
  }

  filterEntries<T>(entries: Array<Entry>, filter: (entry: Entry) => boolean): Array<T> {
    return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
  }
}
