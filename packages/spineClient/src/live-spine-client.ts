import {Logger} from "@aws-lambda-powertools/logger"
import {serviceHealthCheck, StatusCheckResponse} from "./status"
import {SpineClient} from "./spine-client"
import {Agent} from "https"
import axios, {AxiosResponse} from "axios"
import {APIGatewayProxyEventHeaders} from "aws-lambda"
import {extractNHSNumber} from "./extractNHSNumber"

// timeout in ms to wait for response from spine to avoid lambda timeout
const SPINE_TIMEOUT = 45000
export class LiveSpineClient implements SpineClient {
  private readonly SPINE_URL_SCHEME = "https"
  private readonly SPINE_ENDPOINT = process.env.TargetSpineServer
  private readonly spineASID: string | undefined
  private readonly httpsAgent: Agent
  private readonly spinePartyKey: string | undefined

  constructor() {
    this.spineASID = process.env.SpineASID
    this.spinePartyKey = process.env.SpinePartyKey

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
        "Spine-From-Asid": this.spineASID,
        "nhsd-party-key": this.spinePartyKey,
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
        timeout: SPINE_TIMEOUT
      })

      // This can be removed when https://nhsd-jira.digital.nhs.uk/browse/AEA-3448 is complete
      if (
        response.data["statusCode"] !== undefined &&
        response.data["statusCode"] !== "1" &&
        response.data["statusCode"] !== "0"
      ) {
        logger.error("Unsuccessful status code response from spine", {
          response: {
            data: response.data,
            status: response.status,
            Headers: response.headers
          }
        })
        throw new Error("Unsuccessful status code response from spine")
      }
      return response
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error("error in response from spine", {
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
          logger.error("error in request to spine", {
            method: error.request.method,
            path: error.request.path,
            params: error.request.params,
            headers: error.request.headers,
            host: error.request.host
          })
        } else {
          logger.error("general error calling spine", {error})
        }
      } else {
        logger.error("general error", {error})
      }
      throw error
    }
  }

  private getSpineEndpoint(requestPath?: string) {
    return `${this.SPINE_URL_SCHEME}://${this.SPINE_ENDPOINT}/${requestPath}`
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
