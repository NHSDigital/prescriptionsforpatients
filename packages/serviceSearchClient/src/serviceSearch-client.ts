import {Logger} from "@aws-lambda-powertools/logger"
import {LiveServiceSearchClient} from "./live-serviceSearch-client"
import {SandboxServiceSearchClient} from "./sandbox-serviceSearch-client"

export interface ServiceSearchClient {
  searchService(odsCode: string, logger: Logger): Promise<URL | undefined>
}

export function createServiceSearchClient(logger: Logger): ServiceSearchClient {
  const liveMode = process.env.TargetServiceSearchServer !== "sandbox"
  if (liveMode) {
    return new LiveServiceSearchClient(logger)
  } else {
    return new SandboxServiceSearchClient()
  }
}
