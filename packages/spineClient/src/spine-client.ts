import {Logger} from "@aws-lambda-powertools/logger"
import {StatusCheckResponse} from "./status"
import {LiveSpineClient} from "./live-spine-client"
import {SandboxSpineClient} from "./sandbox-spine-client"
import {APIGatewayProxyEventHeaders} from "aws-lambda"
import {AxiosResponse} from "axios"

export interface SpineClient {
  getStatus(): Promise<StatusCheckResponse>
  getPrescriptions(inboundHeaders: APIGatewayProxyEventHeaders): Promise<AxiosResponse>
  isCertificateConfigured(): boolean
}

export function createSpineClient(logger: Logger): SpineClient {
  const liveMode = process.env.TargetSpineServer !== "sandbox"
  if (liveMode) {
    return new LiveSpineClient(logger)
  } else {
    return new SandboxSpineClient()
  }
}
