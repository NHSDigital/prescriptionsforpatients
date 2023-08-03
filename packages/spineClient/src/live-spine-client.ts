import {Logger} from "@aws-lambda-powertools/logger"
import {serviceHealthCheck, StatusCheckResponse} from "./status"
import {SpineClient} from "./spine-client"
import {Agent} from "https"
import axios, {AxiosResponse} from "axios"
import {APIGatewayProxyEventHeaders} from "aws-lambda"

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
    const outboundHeaders = {
      Accept: "application/json",
      "Spine-From-Asid": this.spineASID,
      "nhsd-party-key": this.spinePartyKey
    }

    const address = this.getSpineEndpoint("mm/patientfacingprescriptions")
    logger.info(`making request to ${address}`)
    const queryParams = {
      nhsNumber: inboundHeaders["nhsd-nhslogin-user"]?.split(":")[1]
    }
    const response = await axios.get(address, {
      headers: outboundHeaders,
      params: queryParams,
      httpsAgent: this.httpsAgent
    })

    return response
  }

  private getSpineEndpoint(requestPath?: string) {
    return `${SPINE_URL_SCHEME}://${SPINE_ENDPOINT}/${requestPath}`
  }

  async getStatus(logger: Logger): Promise<StatusCheckResponse> {
    const url = this.getSpineEndpoint("healthcheck")
    return serviceHealthCheck(url, logger, this.httpsAgent)
  }
}
