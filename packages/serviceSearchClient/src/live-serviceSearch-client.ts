import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient, ServiceSearchStatus} from "./serviceSearch-client"
import axios, {Axios, AxiosRequestConfig} from "axios"
import {handleUrl} from "./handleUrl"
import {serviceHealthCheck} from "./status"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
const SERVICE_SEARCH_TIMEOUT = 45000
const DISTANCE_SELLING = "DistanceSelling"

export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly SERVICE_SEARCH_URL_SCHEME = "https"
  private readonly SERVICE_SEARCH_ENDPOINT = process.env.TargetServiceSearchServer
  private readonly axiosInstance: Axios
  private readonly logger: Logger
  private readonly outboundHeaders: {Accept: string, "Subscription-Key": string | undefined}
  private readonly queryParams: {
    "api-version": number,
    "odsCode"?: string,
    "searchFields": string,
    "$filter": string,
    "$select": string,
    "$top": number
  }

  constructor(logger: Logger) {
    this.logger = logger
    this.axiosInstance = axios.create()
    this.outboundHeaders = {
      Accept: "application/json",
      "Subscription-Key": process.env.ServiceSearchApiKey
    }
    this.queryParams = {
      "api-version": 2,
      "searchFields": "ODSCode",
      "$filter": "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
      "$select": "URL,OrganisationSubType",
      "$top": 1
    }
  }

  async searchService(odsCode: string): Promise<URL | undefined> {
    try {
      const address = this.getServiceSearchEndpoint("service-search")
      this.queryParams.odsCode = odsCode

      this.logger.info(`making request to ${address} with ods code ${odsCode}`)
      const response = await axios.get(address, {
        headers: this.outboundHeaders,
        params: this.queryParams,
        timeout: SERVICE_SEARCH_TIMEOUT
      })

      const services = response.data["value"]
      if (services.length === 0) {
        return undefined
      }

      this.logger.info(`service with ods code ${odsCode} is of type ${DISTANCE_SELLING}`)
      const service = services[0]
      const urlString = service["URL"]

      const serviceUrl = handleUrl(urlString, odsCode, this.logger)
      return serviceUrl
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error("error in response from serviceSearch", {
            response: {
              data: error.response.data,
              status: error.response.status,
              Headers: error.response.headers
            },
            request: {
              method: error.request?.path,
              params: error.request?.params,
              headers: error.request?.headers,
              host: error.request?.host
            }
          })
        } else if (error.request) {
          this.logger.error("error in request to serviceSearch", {
            method: error.request.method,
            path: error.request.path,
            params: error.request.params,
            headers: error.request.headers,
            host: error.request.host
          })
        } else {
          this.logger.error("general error calling serviceSearch", {error})
        }
      } else {
        this.logger.error("general error", {error})
      }
      throw error
    }
  }

  private getServiceSearchEndpoint(requestPath?: string) {
    return `${this.SERVICE_SEARCH_URL_SCHEME}://${this.SERVICE_SEARCH_ENDPOINT}/${requestPath}`
  }

  async getStatus(): Promise<ServiceSearchStatus> {
    if (!this.isKeyConfigured()) {
      return {status: "pass", message: "Service Search key is not configured"}
    }

    const axiosConfig: AxiosRequestConfig = {
      timeout: 20000,
      headers: this.outboundHeaders,
      params: {...this.queryParams, odsCode: "X26"}
    }
    let endpoint: string

    if (process.env.healthCheckUrl === undefined) {
      endpoint = this.getServiceSearchEndpoint("service-search")
    } else {
      endpoint = process.env.healthCheckUrl
    }

    const serviceSearchStatus = await serviceHealthCheck(endpoint, this.logger, axiosConfig, this.axiosInstance)
    return {status: serviceSearchStatus.status, serviceSearchStatus: serviceSearchStatus}
  }

  isKeyConfigured(): boolean {
    // Check if the required environment variables are defined
    return (
      process.env.ServiceSearchApiKey !== "ChangeMe"
    )
  }
}
