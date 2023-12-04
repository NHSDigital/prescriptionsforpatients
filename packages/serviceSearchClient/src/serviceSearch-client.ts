import {Logger} from "@aws-lambda-powertools/logger"
import {LiveServiceSearchClient} from "./live-serviceSearch-client"
import {SandboxServiceSearchClient} from "./sandbox-serviceSearch-client"
import {StatusCheckResponse} from "./status"

export type ServiceSearchResponse = {serviceUrl: string, isDistanceSelling: boolean, urlValid: boolean}

export interface ServiceSearchStatus {
  status: string
  message?: string
  serviceSearchStatus?: StatusCheckResponse
}

export interface ServiceSearchClient {
  getStatus(logger: Logger): Promise<ServiceSearchStatus>
  searchService(odsCode: string, logger: Logger): Promise<ServiceSearchResponse>
  isKeyConfigured(): boolean
}

export function createServiceSearchClient(logger: Logger): ServiceSearchClient {
  const liveMode = process.env.TargetServiceSearchServer !== "sandbox"
  if (liveMode) {
    return new LiveServiceSearchClient(logger)
  } else {
    return new SandboxServiceSearchClient()
  }
}
