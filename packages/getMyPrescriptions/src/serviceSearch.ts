import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient, createServiceSearchClient} from "@prescriptionsforpatients/serviceSearchClient"
import {
  Bundle,
  BundleEntry,
  ContactPoint,
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

  async search(searchsetBundle: Bundle) {
    const prescriptions: Array<Bundle> = this.isolatePrescriptions(searchsetBundle)
    const performerReferences: Set<string> = this.getPerformerReferences(prescriptions)
    const performerOrganisations: Array<Organization> = this.getPerformerOrganisations(
      performerReferences, prescriptions
    )
    await this.processOdsCodes(performerOrganisations)
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

  getPerformerOrganisations(performerReferences: Set<string>, prescriptions: Array<Bundle>): Array<Organization> {
    const filter = (entry: Entry) => performerReferences.has(entry.fullUrl!)
    return prescriptions.flatMap((prescription: Bundle) =>
      this.filterAndTypeBundleEntries<Organization>(prescription, filter)
    )
  }

  async processOdsCodes(organisations: Array<Organization>) {
    organisations.forEach(async (organisation: Organization) => {
      const odsCode = organisation.identifier![0].value
      if (odsCode) {
        let urlString: string
        if (odsCode in this.localServicesCache) {
          urlString = this.localServicesCache[odsCode]
          this.replaceAddressWithTelecom(urlString, organisation)
        } else {
          const url = await this.client.searchService(odsCode, this.logger)
          if (url) {
            urlString = url.toString().toLowerCase()
            this.localServicesCache[odsCode.toLowerCase()] = urlString
            this.replaceAddressWithTelecom(urlString, organisation)
          }
        }
      }
    })
  }

  replaceAddressWithTelecom(url: string, organisation: Organization) {
    const telecom: ContactPoint = {system: "url", use: "work", value: url}
    organisation.telecom?.push(telecom)
    delete organisation.address
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
