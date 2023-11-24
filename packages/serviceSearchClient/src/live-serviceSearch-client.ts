import {Logger} from "@aws-lambda-powertools/logger"
import {serviceHealthCheck, StatusCheckResponse} from "./status"
import {ServiceSearchClient} from "./serviceSearch-client"
import {Agent} from "https"
import axios, {AxiosResponse} from "axios"
import {APIGatewayProxyEventHeaders} from "aws-lambda"
import {extractNHSNumber} from "./extractNHSNumber"

// timeout in ms to wait for response from serviceSearch to avoid lambda timeout
const SERVICE_SEARCH_TIMEOUT = 45000
export class LiveServiceSearchClient implements ServiceSearchClient {
  private readonly SERVICE_SEARCH_URL_SCHEME = "https"
  private readonly SERVICE_SEARCH_ENDPOINT = process.env.TargetSpineServer
  private readonly serviceSearchASID: string | undefined
  private readonly httpsAgent: Agent
  private readonly serviceSearchPartyKey: string | undefined

  constructor() {
    this.serviceSearchASID = process.env.SpineASID
    this.serviceSearchPartyKey = process.env.SpinePartyKey

    this.httpsAgent = new Agent({
      cert: process.env.SpinePublicCertificate,
      key: process.env.SpinePrivateKey,
      ca: process.env.SpineCAChain
    })
  }
  async getPrescriptions(inboundHeaders: APIGatewayProxyEventHeaders, logger: Logger): Promise<AxiosResponse> {
    try {
      const address = this.getSpineEndpoint("mm/patientfacingprescriptions")
      // nhsd-nhslogin-user looks like P9:9912003071
      const nhsNumber = extractNHSNumber(inboundHeaders["nhsd-nhslogin-user"])
      logger.info(`nhsNumber: ${nhsNumber}`)

      const outboundHeaders = {
        Accept: "application/json",
        "Spine-From-Asid": this.serviceSearchASID,
        "nhsd-party-key": this.serviceSearchPartyKey,
        nhsNumber: nhsNumber,
        "nhsd-correlation-id": inboundHeaders["nhsd-correlation-id"],
        "nhsd-nhslogin-user": inboundHeaders["nhsd-nhslogin-user"],
        "x-request-id": inboundHeaders["x-request-id"],
        "x-correlation-id": inboundHeaders["x-correlation-id"],
        "nhsd-request-id": inboundHeaders["nhsd-request-id"]
      }

      const queryParams = {
        format: "trace-summary"
      }
      logger.info(`making request to ${address}`)
      const response = await axios.get(address, {
        headers: outboundHeaders,
        params: queryParams,
        httpsAgent: this.httpsAgent,
        timeout: SERVICE_SEARCH_TIMEOUT
      })

      // This can be removed when https://nhsd-jira.digital.nhs.uk/browse/AEA-3448 is complete
      if (
        response.data["statusCode"] !== undefined &&
        response.data["statusCode"] !== "1" &&
        response.data["statusCode"] !== "0"
      ) {
        logger.error("Unsuccessful status code response from serviceSearch", {
          response: {
            data: response.data,
            status: response.status,
            Headers: response.headers
          }
        })
        throw new Error("Unsuccessful status code response from serviceSearch")
      }
      return response
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

  private getSpineEndpoint(requestPath?: string) {
    return `${this.SERVICE_SEARCH_URL_SCHEME}://${this.SERVICE_SEARCH_ENDPOINT}/${requestPath}`
  }

  async getStatus(logger: Logger): Promise<StatusCheckResponse> {
    if (process.env.healthCheckUrl === undefined) {
      return serviceHealthCheck(this.getSpineEndpoint("healthcheck"), logger, this.httpsAgent)
    } else {
      return serviceHealthCheck(process.env.healthCheckUrl, logger, new Agent())
    }
  }

  isCertificateConfigured(): boolean {
    // Check if the required certificate-related environment variables are defined
    return (
      process.env.SpinePublicCertificate !== "ChangeMe" &&
      process.env.SpinePrivateKey !== "ChangeMe" &&
      process.env.SpineCAChain !== "ChangeMe"
    )
  }
}
