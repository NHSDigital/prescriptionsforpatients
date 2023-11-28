import {Logger} from "@aws-lambda-powertools/logger"
import {StatusCheckResponse} from "./status"
import {LiveServiceSearchClient, ServiceSearchResponse} from "./live-serviceSearch-client"
import {SandboxServiceSearchClient} from "./sandbox-serviceSearch-client"

export interface ServiceSearchClient {
  getStatus(logger: Logger): Promise<StatusCheckResponse>
  searchService(odsCode: string, logger: Logger): Promise<ServiceSearchResponse>
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
