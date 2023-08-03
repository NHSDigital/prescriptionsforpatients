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
    try {
      const outboundHeaders = {
        Accept: "application/json",
        "Spine-From-Asid": this.spineASID,
        "nhsd-party-key": this.spinePartyKey
      }

      const address = this.getSpineEndpoint("mm/patientfacingprescriptions")
      // nhsd-nhslogin-user looks like P9:9912003071
      const nhsNumber = this.extractNHSNumber(inboundHeaders["nhsd-nhslogin-user"])
      logger.info(`nhsNumber: ${nhsNumber}`)

      const queryParams = {
        nhsNumber: nhsNumber
      }
      logger.info(`making request to ${address}`)
      const response = await axios.get(address, {
        headers: outboundHeaders,
        params: queryParams,
        httpsAgent: this.httpsAgent
      })

      if (response.data["statusCode"] !== 0) {
        logger.error("Unsuccessful status code response from spine", {
          response: {
            data: response.data,
            status: response.status,
            Headers: response.headers
          }
        })
        throw "Unsuccessful status code response from spine"
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
          logger.error("general error calling spine")
        }
      } else {
        logger.error("general error")
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

  private extractNHSNumber(nhsloginUser: string | undefined): string {
    if (nhsloginUser === undefined || nhsloginUser === null) {
      throw "NHS Number not passed in"
    }
    let nhsNumber = nhsloginUser.split(":")[1]
    if (
      nhsNumber === undefined ||
      nhsNumber === null ||
      isNaN(Number(nhsNumber)) ||
      nhsNumber.toString().length !== 10
    ) {
      throw "NHS Number failed preflight checks"
    }

    // convert numbers to strings, for internal consistency
    if (Number.isInteger(nhsNumber)) {
      nhsNumber = nhsNumber.toString()
    }

    // Step 1: Multiply each of the first 9 numbers by (11 - position indexed from 1)
    // Step 2: Add the results together
    // Step 3: Divide the total by 11 to get the remainder
    const nhsNumberAsArray: string[] = nhsNumber.split("")
    const remainder = nhsNumberAsArray.slice(0, 9).map(this.multiplyByPosition).reduce(this.addTogether, 0) % 11

    let checkDigit = 11 - remainder

    // replace 11 for 0
    if (checkDigit === 11) {
      checkDigit = 0
    }

    const providedCheckDigit = nhsNumberAsArray[9]

    // Do the check digits match?
    if (checkDigit !== Number(providedCheckDigit)) {
      throw "invalid check digit in NHS number"
    }
    return nhsNumber
  }

  private multiplyByPosition(digit: string, index: number) {
    // multiple each digit by 11  minus its position (indexed from 1)
    return parseInt(digit) * (11 - (index + 1))
  }

  private addTogether(previousValue: number, currentValue: number) {
    return previousValue + currentValue
  }
}
