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

const DEFAULT_CACHE_MAX_ENTRIES = 1_000

class LruServicesCache {
  private readonly usageOrder: Array<string>

  constructor(
    private readonly cache: ServicesCache,
    private readonly maxEntries: number
  ) {
    this.usageOrder = Object.keys(this.cache)
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, key)
  }

  get(key: string): string | undefined {
    if (!this.has(key)) {
      return undefined
    }
    this.touch(key)
    return this.cache[key]
  }

  set(key: string, value: string | undefined): void {
    const keyAlreadyPresent = this.has(key)
    if (!keyAlreadyPresent && this.maxEntries > 0 && this.usageOrder.length >= this.maxEntries) {
      const leastRecentlyUsed = this.usageOrder[0]
      delete this.cache[leastRecentlyUsed]
      this.removeFromUsageOrder(leastRecentlyUsed)
    }

    this.cache[key] = value
    this.touch(key)
  }

  private touch(key: string): void {
    this.removeFromUsageOrder(key)
    this.usageOrder.push(key)
  }

  private removeFromUsageOrder(key: string): void {
    const keyIndex = this.usageOrder.indexOf(key)
    if (keyIndex !== -1) {
      this.usageOrder.splice(keyIndex, 1)
    }
  }
}

export class DistanceSelling {
  private readonly logger: Logger
  private readonly client: ServiceSearchClient
  private readonly servicesCache: LruServicesCache

  constructor(servicesCache: ServicesCache, logger: Logger, maxCacheEntries: number = DEFAULT_CACHE_MAX_ENTRIES) {
    this.logger = logger
    this.client = createServiceSearchClient(this.logger)
    this.servicesCache = new LruServicesCache(servicesCache, maxCacheEntries)
  }

  async search(searchsetBundle: Bundle, correlationId: string) {
    const prescriptions: Array<Bundle> = this.isolatePrescriptions(searchsetBundle)
    const performerReferences: Set<string> = this.getPerformerReferences(prescriptions)
    const performerOrganisations: Array<Organization> = this.getPerformerOrganisations(
      performerReferences, prescriptions
    )
    await this.processOdsCodes(performerOrganisations, correlationId)
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

  async processOdsCodes(organisations: Array<Organization>, correlationId: string) {
    for (const organisation of organisations) {
      const odsCode = organisation.identifier![0].value?.toLowerCase()
      if (odsCode) {
        let urlString: string | undefined
        if (this.servicesCache.has(odsCode)) {
          this.logger.info(
            `ods code ${odsCode} found in cache. not calling service search.`, {odsCode: odsCode, cacheHit: true}
          )
          urlString = this.servicesCache.get(odsCode)
          if (urlString) {
            this.addToTelecom(urlString, organisation)
            // remove physical address for distance‐selling (online) pharmacies
            delete organisation.address
          }
        } else {
          this.logger.info(
            `ods code ${odsCode} not found in cache. calling service search.`, {odsCode: odsCode, cacheHit: false}
          )
          await this.searchOdsCode(odsCode, organisation, correlationId)
        }
      }
    }
  }

  async searchOdsCode(odsCode: string, organisation: Organization, correlationId: string) {
    let url: URL | undefined
    try {
      url = await this.client.searchService(odsCode, correlationId, this.logger)
    } catch {
      this.logger.warn(`call to service search unsuccessful for odsCode ${odsCode}`, {odsCode: odsCode})
      return
    }
    if (url) {
      const urlString = this.getUrlString(url)
      this.servicesCache.set(odsCode, urlString)
      this.logger.info(`url ${urlString} added to cache for ods code ${odsCode}.`, {odsCode: odsCode})
      this.addToTelecom(urlString, organisation)
      // remove physical address for distance‐selling (online) pharmacies
      delete organisation.address
    } else {
      this.servicesCache.set(odsCode, undefined)
    }
  }

  getUrlString(url: URL): string {
    const urlString = url.toString().split("://")[1].toLowerCase()
    return urlString.endsWith("/") ? urlString.slice(0, -1) : urlString
  }

  addToTelecom(url: string, organisation: Organization) {
    organisation.telecom ??= []

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
