import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient} from "./serviceSearch-client"
import axios from "axios"
import {validateUrl} from "./validateUrl"
import {StatusCheckResponse, serviceHealthCheck} from "./status"

type ServiceSearchResponse = {serviceUrl: string, isDistanceSelling: boolean, urlValid: boolean}

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
const SERVICE_SEARCH_TIMEOUT = 45000
const DISTANCE_SELLING = "DistanceSelling"
export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly SERVICE_SEARCH_URL_SCHEME = "https"
  private readonly SERVICE_SEARCH_ENDPOINT = process.env.TargetServiceSearchServer

  async searchService(odsCode: string, logger: Logger): Promise<ServiceSearchResponse> {
    try {
      const address = this.getServiceSearchEndpoint("service-search")
      const outboundHeaders = {
        Accept: "application/json",
        "Subscription-Key": process.env.ServiceSearchApiKey
      }

      const queryParams = {
        search: odsCode
      }
      logger.info(`making request to ${address} with ods code ${odsCode}`)
      const response = await axios.get(address, {
        headers: outboundHeaders,
        params: queryParams,
        timeout: SERVICE_SEARCH_TIMEOUT
      })

      const isDistanceSelling = response.data["value"]["OrganisationSubType"] === DISTANCE_SELLING
      const serviceUrl = response.data["value"]["URL"]
      const urlValid = validateUrl(serviceUrl, logger)

      if (isDistanceSelling) {
        logger.info(`service with ods code ${odsCode} is of type ${DISTANCE_SELLING}`)
      }

      return {
        serviceUrl: serviceUrl,
        isDistanceSelling: isDistanceSelling,
        urlValid: urlValid
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error("error in response from serviceSearch", {
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
          logger.error("error in request to serviceSearch", {
            method: error.request.method,
            path: error.request.path,
            params: error.request.params,
            headers: error.request.headers,
            host: error.request.host
          })
        } else {
          logger.error("general error calling serviceSearch", {error})
        }
      } else {
        logger.error("general error", {error})
      }
      throw error
    }
  }

  private getServiceSearchEndpoint(requestPath?: string) {
    return `${this.SERVICE_SEARCH_URL_SCHEME}://${this.SERVICE_SEARCH_ENDPOINT}/${requestPath}`
  }

  async getStatus(logger: Logger): Promise<StatusCheckResponse> {
    if (process.env.healthCheckUrl === undefined) {
      return serviceHealthCheck(this.getServiceSearchEndpoint("healthcheck"), logger)
    } else {
      return serviceHealthCheck(process.env.healthCheckUrl, logger)
    }
  }

  isKeyConfigured(): boolean {
    // Check if the required environment variables are defined
    return (
      process.env.ServiceSearchApiKey !== "ChangeMe"
    )
  }
}

export {ServiceSearchResponse}
