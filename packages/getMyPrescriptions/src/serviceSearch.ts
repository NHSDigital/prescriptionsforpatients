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
    return this.filterAndTypeBundleEntries<Bundle>(searchsetBundle, filter)
  }

  getPerformerReferences(prescriptions: Array<Bundle>): Set<string> {
    const filter = (entry: Entry) => entry.resource!.resourceType === "MedicationRequest"
    const medicationRequests = prescriptions.flatMap((prescription: Bundle) =>
      this.filterAndTypeBundleEntries<MedicationRequest>(prescription, filter)
    )

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
    const filter = (entry: Entry) => performerReferences.has(entry.fullUrl!)
    const organisations = prescriptions.flatMap((prescription: Bundle) =>
      this.filterAndTypeBundleEntries<Organization>(prescription, filter)
    )

    const odsCodes: Set<string> = new Set<string>()
    organisations.forEach((organisation: Organization) => {
      const odsCode = organisation.identifier![0].value
      if (odsCode) {
        odsCodes.add(odsCode)
      }
    })
    return odsCodes
  }

  filterAndTypeBundleEntries<T>(bundle: Bundle, filter: (entry: Entry) => boolean): Array<T> {
    const entries = bundle.entry
    if (entries) {
      return entries.filter((entry) => filter(entry)).map((entry) => entry.resource) as Array<T>
    } else {
      return []
    }
  }
}
