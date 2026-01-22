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

export const SERVICE_SEARCH_BASE_QUERY_PARAMS = {
  "api-version": 2,
  "searchFields": "ODSCode",
  "$filter": "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
  "$select": "URL,OrganisationSubType",
  "$top": 1
}

export function getServiceSearchEndpoint(): string {
  const endpoint = process.env.TargetServiceSearchServer || "service-search"
  const baseUrl = `https://${endpoint}`
  if (endpoint.toLowerCase().includes("api.service.nhs.uk")) {
    // service search v3
    SERVICE_SEARCH_BASE_QUERY_PARAMS["api-version"] = 3
    return `${baseUrl}/service-search-api/`
  }
  // service search v2
  return `${baseUrl}/service-search`
}

export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly axiosInstance: AxiosInstance
  private readonly logger: Logger
  private readonly outboundHeaders: {"apikey": string | undefined, "Subscription-Key": string | undefined}

  constructor(logger: Logger) {
    this.logger = logger

    this.axiosInstance = axios.create()
    axiosRetry(this.axiosInstance, {retries: 3})

    this.axiosInstance.interceptors.request.use((config) => {
      config.headers["request-startTime"] = Date.now()
      return config
    })
    this.axiosInstance.interceptors.response.use((response) => {
      const currentTime = Date.now()
      const startTime = response.config.headers["request-startTime"]
      this.logger.info("serviceSearch request duration", {serviceSearch_duration: currentTime - startTime})

      return response
    }, (error) => {
      const currentTime = Date.now()
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
      "Subscription-Key": process.env.ServiceSearchApiKey,
      "apikey": process.env.ServiceSearch3ApiKey
    }
  }

  async searchService(odsCode: string): Promise<URL | undefined> {
    try {
      const address = getServiceSearchEndpoint()
      const queryParams = {...SERVICE_SEARCH_BASE_QUERY_PARAMS, search: odsCode}

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
    const headerKeys = ["subscription-key", "apikey"]
    headerKeys.forEach((key) => {
      if (error.response?.headers) {
        delete error.response.headers[key]
      }
      if (error.request?.headers) {
        delete error.request.headers[key]
      }
    })
  }
}
