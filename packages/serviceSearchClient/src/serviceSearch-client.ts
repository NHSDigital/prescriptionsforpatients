import {Logger} from "@aws-lambda-powertools/logger"
import {StatusCheckResponse} from "./status"
import {LiveServiceSearchClient} from "./live-serviceSearch-client"
import {SandboxServiceSearchClient} from "./sandbox-serviceSearch-client"
import {APIGatewayProxyEventHeaders} from "aws-lambda"
import {AxiosResponse} from "axios"

export interface ServiceSearchClient {
  getStatus(logger: Logger): Promise<StatusCheckResponse>
  getPrescriptions(inboundHeaders: APIGatewayProxyEventHeaders, logger: Logger): Promise<AxiosResponse>
  isCertificateConfigured(): boolean
}

export function createServiceSearchClient(): ServiceSearchClient {
  const liveMode = process.env.TargetServiceSearchServer !== "sandbox"
  if (liveMode) {
    return new LiveServiceSearchClient()
  } else {
    return new SandboxServiceSearchClient()
  }
}
