import {Logger} from "@aws-lambda-powertools/logger"
import {serviceHealthCheck} from "./status"
import {SpineClient, SpineStatus} from "./spine-client"
import {Agent} from "https"
import axios, {Axios, AxiosRequestConfig, AxiosResponse} from "axios"
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
  private readonly axiosInstance: Axios
  private readonly logger: Logger

  constructor(logger: Logger) {
    this.spineASID = process.env.SpineASID
    this.spinePartyKey = process.env.SpinePartyKey

    this.httpsAgent = new Agent({
      cert: process.env.SpinePublicCertificate,
      key: process.env.SpinePrivateKey,
      ca: process.env.SpineCAChain
    })
    this.logger = logger
    this.axiosInstance = axios.create()
    this.axiosInstance.interceptors.request.use((config) => {
      config.headers["request-startTime"] = new Date().getTime()
      return config
    })

    this.axiosInstance.interceptors.response.use((response) => {
      const currentTime = new Date().getTime()
      const startTime = response.config.headers["request-startTime"]
      this.logger.info("spine request duration", {spine_duration: currentTime - startTime})

      return response
    }, (error) => {
      const currentTime = new Date().getTime()
      const startTime = error.config?.headers["request-startTime"]
      this.logger.info("spine request duration", {spine_duration: currentTime - startTime})

      return Promise.reject(error)
    })

  }
  async getPrescriptions(inboundHeaders: APIGatewayProxyEventHeaders): Promise<AxiosResponse> {
    try {
      const address = this.getSpineEndpoint("mm/patientfacingprescriptions")
      // nhsd-nhslogin-user looks like P9:9912003071
      const nhsNumber = extractNHSNumber(inboundHeaders["nhsd-nhslogin-user"])
      this.logger.info("NHS", {NhsNumber: nhsNumber})

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
      this.logger.info(`making request to ${address}`)
      const response = await this.axiosInstance.get(address, {
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
        this.logger.error("Unsuccessful status code response from spine", {
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
          this.logger.error("error in response from spine", {
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
          this.logger.error("error in request to spine", {
            method: error.request.method,
            path: error.request.path,
            params: error.request.params,
            headers: error.request.headers,
            host: error.request.host
          })
        } else {
          this.logger.error("general error calling spine", {error})
        }
      } else {
        this.logger.error("general error", {error})
      }
      throw error
    }
  }

  private getSpineEndpoint(requestPath?: string) {
    return `${this.SPINE_URL_SCHEME}://${this.SPINE_ENDPOINT}/${requestPath}`
  }

  async getStatus(): Promise<SpineStatus> {
    if (!this.isCertificateConfigured()) {
      return {status: "pass", message: "Spine certificate is not configured"}
    }

    const axiosConfig: AxiosRequestConfig = {timeout: 20000}
    let endpoint: string

    if (process.env.healthCheckUrl === undefined) {
      axiosConfig.httpsAgent = this.httpsAgent
      endpoint = this.getSpineEndpoint("healthcheck")
    } else {
      axiosConfig.httpsAgent = new Agent()
      endpoint = process.env.healthCheckUrl
    }

    const spineStatus = await serviceHealthCheck(endpoint, this.logger, axiosConfig, this.axiosInstance)
    return {status: spineStatus.status, spineStatus: spineStatus}
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
