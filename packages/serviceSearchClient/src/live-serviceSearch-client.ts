import {Logger} from "@aws-lambda-powertools/logger"
import {getSecret} from "@aws-lambda-powertools/parameters/secrets"
import axios, {AxiosError, AxiosInstance} from "axios"
import axiosRetry, {isNetworkOrIdempotentRequestError} from "axios-retry"
import {handleUrl} from "./handleUrl"

import {ServiceSearchClient} from "./serviceSearch-client"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
// each call is retried up to 3 times so total wait time could be up to 4x this value
const SERVICE_SEARCH_TIMEOUT = 1000 // 1 second
const DISTANCE_SELLING = "DistanceSelling"

type Contact = {
  "ContactMethodType": string
  "ContactValue": string
}

export type ServiceSearch3Data = {
  "@odata.context": string
  "value": Array<{
    "@search.score": number
    "OrganisationSubType": string
    "Contacts": Array<Contact>
  }>
}

export const SERVICE_SEARCH_BASE_QUERY_PARAMS = {
  "api-version": 3,
  "searchFields": "ODSCode",
  "$filter": `OrganisationTypeId eq 'PHA' and OrganisationSubType eq '${DISTANCE_SELLING}'`,
  "$select": "Contacts,OrganisationSubType",
  "$top": 1
}

export function getServiceSearchVersion(logger: Logger | null = null): number {
  logger?.info("Service search v3 enabled")
  return 3
}

export function getServiceSearchEndpoint(logger: Logger | null = null): string {
  logger?.info("Using service search v3 endpoint")
  return `https://${process.env.TargetServiceSearchServer}/service-search-api/`
}

export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly axiosInstance: AxiosInstance
  private readonly logger: Logger
  private readonly outboundHeaders: {
    "apikey"?: string,
    "x-request-id"?: string,
    "x-correlation-id"?: string
  }

  constructor(logger: Logger) {
    this.logger = logger
    this.logger.info("ServiceSearchClient configured",
      {
        v3: process.env.ServiceSearch3ApiKey !== undefined
      })
    this.axiosInstance = axios.create()
    axiosRetry(this.axiosInstance, {
      retries: 3,
      onRetry: this.onAxiosRetry,
      retryCondition: this.retryCondition
    })

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
        this.logger.error("Error in serviceSearch request", {error})
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

        this.logger.error("Axios error in serviceSearch request", {axiosErrorDetails})
        err = new Error("Axios error in serviceSearch request")
      } else {
        this.logger.error("Unknown error in serviceSearch request", {error})
        err = new Error("Unknown error in serviceSearch request")
      }
      return Promise.reject(err)
    })

    this.outboundHeaders = {
      "apikey": process.env.ServiceSearch3ApiKey
    }
  }

  private async loadApiKeyFromSecretsManager(): Promise<string | undefined> {
    try {
      const secretArn = process.env.ServiceSearch3ApiKeyARN
      if (!secretArn) {
        this.logger.error("ServiceSearch3ApiKeyARN environment variable is not set")
        return undefined
      }
      this.logger.info("Loading ServiceSearch API key from Secrets Manager", {secretArn})

      const secret = await getSecret(secretArn, {
        maxAge: 300 // Cache for 5 minutes
      })

      this.logger.info("Successfully loaded ServiceSearch API key from Secrets Manager")
      return secret as string
    } catch (error) {
      this.logger.error("Failed to load ServiceSearch API key from Secrets Manager", {error})
      return undefined
    }
  }

  async searchService(odsCode: string, correlationId: string): Promise<URL | undefined> {
    try {
      // Load API key if not set in environment (secrets layer is being deprecated)
      if (!this.outboundHeaders.apikey) {
        this.logger.info("API key not in environment, attempting to load from Secrets Manager")
        this.outboundHeaders.apikey = await this.loadApiKeyFromSecretsManager()
      }
      this.outboundHeaders["x-correlation-id"] = correlationId
      const xRequestId = crypto.randomUUID()
      this.outboundHeaders["x-request-id"] = xRequestId

      const address = getServiceSearchEndpoint(this.logger)
      const queryParams = {...SERVICE_SEARCH_BASE_QUERY_PARAMS, search: odsCode}

      this.logger.info(`making request to ${address} with ods code ${odsCode}`, {
        odsCode: odsCode,
        requestHeaders: {
          "x-request-id": xRequestId,
          "x-correlation-id": correlationId
        }
      })
      const response = await this.axiosInstance.get(address, {
        headers: this.outboundHeaders,
        params: queryParams,
        timeout: SERVICE_SEARCH_TIMEOUT
      })

      this.logger.info(`received response from serviceSearch for ods code ${odsCode}`,
        {odsCode: odsCode, status: response.status, data: response.data})
      return this.handleV3Response(odsCode, response.data)

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
  handleV3Response(odsCode: string, data: ServiceSearch3Data): URL | undefined {
    const contacts = data.value[0]?.Contacts
    const websiteContact = contacts?.find((contact: Contact) => contact.ContactMethodType === "Website")
    const websiteUrl = websiteContact?.ContactValue
    if (!websiteUrl) {
      this.logger.warn(`pharmacy with ods code ${odsCode} has no website`, {odsCode: odsCode})
      return undefined
    }
    const serviceUrl = handleUrl(websiteUrl, odsCode, this.logger)
    return serviceUrl
  }

  stripApiKeyFromHeaders(error: AxiosError) {
    const headerKeys = ["apikey"]
    headerKeys.forEach((key) => {
      if (error.response?.headers?.[key]) {
        delete error.response.headers[key]
      }
      if (error.request?.headers?.[key]) {
        delete error.request.headers[key]
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAxiosRetry = (retryCount: number, error: any) => {
    this.logger.warn(error)
    this.logger.warn(`Call to serviceSearch failed - retrying. Retry count ${retryCount}`, {retryCount: retryCount})
  }
  retryCondition(error: AxiosError): boolean {
    return isNetworkOrIdempotentRequestError(error) || error.code === "ECONNABORTED"
  }
}
