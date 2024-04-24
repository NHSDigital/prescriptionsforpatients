import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient, createServiceSearchClient} from "@prescriptionsforpatients/serviceSearchClient"
import {ContactPoint, Organization} from "fhir/r4"

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

  async search(organisations: Array<Organization>) {
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
}
