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

export type Entry = BundleEntry<FhirResource>
export type ServicesCache = Record<string, string | undefined>

export class DistanceSelling {
  private readonly logger: Logger
  private readonly client: ServiceSearchClient
  private servicesCache: ServicesCache

  constructor(servicesCache: ServicesCache, logger: Logger) {
    this.logger = logger
    this.client = createServiceSearchClient(this.logger)
    this.servicesCache = servicesCache
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
    for (const organisation of organisations) {
      const odsCode = organisation.identifier![0].value?.toLowerCase()
      if (odsCode) {
        let urlString: string | undefined
        if (odsCode in this.servicesCache) {
          this.logger.info(
            `ods code ${odsCode} found in cache. not calling service search.`, {odsCode: odsCode, cacheHit: true}
          )
          urlString = this.servicesCache[odsCode]
          if (urlString) {
            this.addToTelecom(urlString, organisation)
          }
        } else {
          this.logger.info(
            `ods code ${odsCode} not found in cache. calling service search.`, {odsCode: odsCode, cacheHit: false}
          )
          await this.searchOdsCode(odsCode, organisation)
        }
      }
    }
  }

  async searchOdsCode(odsCode: string, organisation: Organization) {
    let url: URL | undefined
    try {
      url = await this.client.searchService(odsCode, this.logger)
    } catch {
      this.logger.warn(`call to service search unsuccessful for odsCode ${odsCode}`, {odsCode: odsCode})
      return
    }
    if (url) {
      const urlString = this.getUrlString(url)
      this.servicesCache[odsCode] = urlString
      this.logger.info(`url ${urlString} added to cache for ods code ${odsCode}.`, {odsCode: odsCode})
      this.addToTelecom(urlString, organisation)
    } else {
      this.servicesCache[odsCode] = undefined
    }
  }

  getUrlString(url: URL): string {
    const urlString = url.toString().split("://")[1].toLowerCase()
    return urlString.endsWith("/") ? urlString.slice(0, -1) : urlString
  }

  addToTelecom(url: string, organisation: Organization) {
    if (!organisation.telecom) {
      organisation.telecom = []
    }
    const urlEntryAbsent: boolean = organisation.telecom.filter(entry => entry.system === "url").length === 0
    if (urlEntryAbsent) {
      const telecom: ContactPoint = {system: "url", use: "work", value: url}
      organisation.telecom.push(telecom)
    }
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
