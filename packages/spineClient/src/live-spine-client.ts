import {Logger} from "@aws-lambda-powertools/logger"
import {serviceHealthCheck, StatusCheckResponse} from "./status"
import {SpineClient} from "./spine-client"
import {Agent} from "https"
import axios, {AxiosResponse} from "axios"
import {APIGatewayProxyEventHeaders} from "aws-lambda"
import {extractNHSNumber} from "./extractNHSNmuber"

const SPINE_URL_SCHEME = "https"
const SPINE_ENDPOINT = process.env.TargetSpineServer

export class LiveSpineClient implements SpineClient {
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
        nhsNumber: nhsNumber
      }

      const queryParams = {
        nhsNumber: nhsNumber
      }
      logger.info(`making request to ${address}`)
      const response = await axios.get(address, {
        headers: outboundHeaders,
        params: queryParams,
        httpsAgent: this.httpsAgent
      })

      if (response.data["statusCode"] !== "1" && response.data["statusCode"] !== "0") {
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
              method: error.request.method,
              path: error.request.path,
              params: error.request.params,
              headers: error.request.headers,
              host: error.request.host
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
    return `${SPINE_URL_SCHEME}://${SPINE_ENDPOINT}/${requestPath}`
  }

  async getStatus(logger: Logger): Promise<StatusCheckResponse> {
    const url = this.getSpineEndpoint("healthcheck")
    return serviceHealthCheck(url, logger, this.httpsAgent)
  }
}
