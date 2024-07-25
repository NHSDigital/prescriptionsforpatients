import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient} from "./serviceSearch-client"
import axios, {AxiosError, AxiosInstance} from "axios"
import axiosRetry from "axios-retry"
import {handleUrl} from "./handleUrl"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
export const SERVICE_SEARCH_TIMEOUT = 45000
const DISTANCE_SELLING = "DistanceSelling"

type Service = {
  URL: string
  OrganisationSubType: string
}

export type ServiceSearchData = {
  value: Array<Service>
}

export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly SERVICE_SEARCH_URL_SCHEME = "https"
  private readonly SERVICE_SEARCH_ENDPOINT = process.env.TargetServiceSearchServer
  private readonly axiosInstance: AxiosInstance
  private readonly logger: Logger
  private readonly outboundHeaders: {"Subscription-Key": string | undefined}
  private readonly baseQueryParams: {
    "api-version": number
    searchFields: string
    $filter: string
    $select: string
    $top: number
  }

  constructor(logger: Logger) {
    this.logger = logger

    this.axiosInstance = axios.create()
    axiosRetry(this.axiosInstance, {retries: 3})

    this.axiosInstance.interceptors.request.use((config) => {
      config.headers["request-startTime"] = new Date().getTime()
      return config
    })

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const currentTime = new Date().getTime()
        const startTime = response.config.headers["request-startTime"]
        this.logger.info("serviceSearch request duration", {serviceSearch_duration: currentTime - startTime})
        return response
      },
      (error) => {
        const currentTime = new Date().getTime()
        const startTime = error.config?.headers["request-startTime"]
        this.logger.info("serviceSearch request duration", {serviceSearch_duration: currentTime - startTime})

        if (axios.isAxiosError(error)) {
          if (error.code === "ECONNABORTED") {
            this.logger.error("serviceSearch request timed out", {
              odsCode: error.config?.params?.search,
              timeout: SERVICE_SEARCH_TIMEOUT
            })
          }
        }

        return Promise.reject(error)
      }
    )

    this.outboundHeaders = {
      "Subscription-Key": process.env.ServiceSearchApiKey
    }
    this.baseQueryParams = {
      "api-version": 2,
      searchFields: "ODSCode",
      $filter: "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
      $select: "URL,OrganisationSubType",
      $top: 1
    }
  }

  async searchService(odsCode: string): Promise<URL | undefined> {
    try {
      const address = this.getServiceSearchEndpoint()
      const queryParams = {...this.baseQueryParams, search: odsCode}

      this.logger.info(`making request to ${address} with ods code ${odsCode}`, {odsCode: odsCode})

      const response = await this.axiosInstance.get(address, {
        headers: this.outboundHeaders,
        params: queryParams,
        timeout: SERVICE_SEARCH_TIMEOUT
      })

      this.logger.info("serviceSearch request received", {
        status: response.status,
        statusText: response.statusText,
        odsCode: odsCode
      })

      const serviceSearchResponse: ServiceSearchData = response.data
      const services = serviceSearchResponse.value
      if (services.length === 0) {
        return undefined
      }

      this.logger.info(`pharmacy with ods code ${odsCode} is of type ${DISTANCE_SELLING}`, {odsCode: odsCode})
      const service = services[0]
      const urlString = service["URL"]

      if (urlString === null) {
        this.logger.warn(`ods code ${odsCode} has no URL but is of type ${DISTANCE_SELLING}`, {odsCode: odsCode})
        return undefined
      }
      const serviceUrl = handleUrl(urlString, odsCode, this.logger)
      return serviceUrl
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          this.logger.error("serviceSearch request timed out", {
            odsCode: odsCode,
            timeout: SERVICE_SEARCH_TIMEOUT,
            message: error.message,
            stack: error.stack
          })
        } else {
          this.logger.error("error in request to serviceSearch", {
            error: error.message,
            code: error.code,
            stack: error.stack,
            response: error.response
              ? {
                data: error.response.data,
                status: error.response.status,
                headers: error.response.headers
              }
              : undefined,
            request: error.request
              ? {
                method: error.request.method,
                url: error.request.url,
                headers: error.request.headers
              }
              : undefined
          })
        }
      } else {
        this.logger.error("general error", {error: (error as Error).message, stack: (error as Error).stack})
      }
      throw error
    }
  }

  stripApiKeyFromHeaders(error: AxiosError) {
    const headerKey = "subscription-key"
    if (error.response?.headers) {
      delete error.response.headers[headerKey]
    }
    if (error.request?.headers) {
      delete error.request.headers[headerKey]
    }
  }

  private getServiceSearchEndpoint() {
    return `${this.SERVICE_SEARCH_URL_SCHEME}://${this.SERVICE_SEARCH_ENDPOINT}/service-search`
  }
}
