import {Logger} from "@aws-lambda-powertools/logger"
import axios, {AxiosError, AxiosInstance} from "axios"
import axiosRetry from "axios-retry"
import {handleUrl} from "./handleUrl"

import {ServiceSearchClient} from "./serviceSearch-client"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
const SERVICE_SEARCH_TIMEOUT = 45000
const DISTANCE_SELLING = "DistanceSelling"

type Service = {
  "URL": string
  "OrganisationSubType": string
}

export type ServiceSearchData = {
  "value": Array<Service>
}

export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly SERVICE_SEARCH_URL_SCHEME = "https"
  private readonly SERVICE_SEARCH_ENDPOINT = process.env.TargetServiceSearchServer
  private readonly axiosInstance: AxiosInstance
  private readonly logger: Logger
  private readonly outboundHeaders: {"Subscription-Key": string | undefined}
  private readonly baseQueryParams: {
    "api-version": number,
    "searchFields": string,
    "$filter": string,
    "$select": string,
    "$top": number
  }

  constructor(logger: Logger) {
    this.logger = logger

    this.axiosInstance = axios.create()
    axiosRetry(this.axiosInstance, {retries: 3})

    this.axiosInstance.interceptors.request.use((config) => {
      config.headers["request-startTime"] = new Date().getTime()
      return config
    })
    this.axiosInstance.interceptors.response.use((response) => {
      const currentTime = new Date().getTime()
      const startTime = response.config.headers["request-startTime"]
      this.logger.info("serviceSearch request duration", {serviceSearch_duration: currentTime - startTime})

      return response
    }, (error) => {
      const currentTime = new Date().getTime()
      const startTime = error.config?.headers["request-startTime"]
      this.logger.info("serviceSearch request duration", {serviceSearch_duration: currentTime - startTime})

      // reject with a proper Error object
      let err: Error
      if (error instanceof Error) {
        logger.error("Error in serviceSearch request", {error})
        err = error
      } else if ((error as AxiosError).message) {
        // Only report the interesting subset of the error object.
        let axiosErrorDetails = {}
        if (error.response) {
          axiosErrorDetails = {response: {
            data: error.data,
            status: error.status,
            headers: error.headers
          }}
        }
        if (error.request) {
          axiosErrorDetails = {
            ...axiosErrorDetails,
            request: error.request
          }
        }

        logger.error("Axios error in serviceSearch request", {axiosErrorDetails})
        err = new Error("Axios error in serviceSearch request")
      } else {
        logger.error("Unknown error in serviceSearch request", {error})
        err = new Error("Unknown error in serviceSearch request")
      }
      return Promise.reject(err)
    })

    this.outboundHeaders = {
      "Subscription-Key": process.env.ServiceSearchApiKey
    }
    this.baseQueryParams = {
      "api-version": 2,
      "searchFields": "ODSCode",
      "$filter": "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
      "$select": "URL,OrganisationSubType",
      "$top": 1
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
        this.stripApiKeyFromHeaders(error)
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
          this.logger.error("error in request to serviceSearch", {error})
        } else {
          this.logger.error("general error calling serviceSearch", {error})
        }
      } else {
        this.logger.error("general error", {error})
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
