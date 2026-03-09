import {Logger} from "@aws-lambda-powertools/logger"
import {getSecret} from "@aws-lambda-powertools/parameters/secrets"
import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  isAxiosError
} from "axios"
import axiosRetry, {isNetworkOrIdempotentRequestError} from "axios-retry"
import {handleUrl} from "./handleUrl"
import {Agent} from "https"

import {ServiceSearchClient} from "./serviceSearch-client"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
// each call is retried up to 3 times so total wait time could be up to 4x this value
const SERVICE_SEARCH_TIMEOUT = 3000 // 3 seconds
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
  private readonly httpsAgent: Agent
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
    this.httpsAgent = new Agent({
      keepAlive: true
    })
    this.axiosInstance = axios.create({
      httpsAgent: this.httpsAgent
    })
    axiosRetry(this.axiosInstance, {
      retries: 3,
      shouldResetTimeout: true,
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
      this.logger.info("serviceSearch request duration", {
        serviceSearch_duration: currentTime - startTime,
        serviceSearch_keepAliveEnabled: this.httpsAgent.options.keepAlive === true,
        serviceSearch_reusedSocket: this.getReusedSocket(response.request)
      })

      return response
    }, (error) => {
      const currentTime = Date.now()
      const startTime = error.config?.headers["request-startTime"]
      this.logger.info("serviceSearch request duration", {
        serviceSearch_duration: currentTime - startTime,
        serviceSearch_keepAliveEnabled: this.httpsAgent.options.keepAlive === true,
        serviceSearch_reusedSocket: this.getReusedSocket(error.request)
      })

      // reject with a proper Error object
      let err: Error
      if (isAxiosError(error)) {
        this.stripApiKeyFromHeaders(error)
        this.logger.error("Axios error in serviceSearch request", {
          axiosErrorDetails: {
            request: error.request,
            response: {
              data: error.response?.data,
              status: error.response?.status,
              headers: error.response?.headers as AxiosHeaders
            }
          }
        })
        err = new Error(`Axios error in serviceSearch request: ${error.message}`)
      } else if (error instanceof Error) {
        this.logger.error("Error in serviceSearch request", {error})
        err = error
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
    // Load API key if not set in environment (secrets layer is failing to load v3 key)
    const apiVsn = getServiceSearchVersion(this.logger)
    if (apiVsn === 3 && !this.outboundHeaders.apikey) {
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
  }

  private getReusedSocket(request: unknown): boolean | undefined {
    if (!request || typeof request !== "object") {
      return undefined
    }
    const candidate = request as {reusedSocket?: boolean}
    return candidate.reusedSocket
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
