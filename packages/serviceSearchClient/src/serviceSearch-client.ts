import {Logger} from "@aws-lambda-powertools/logger"
import {LiveServiceSearchClient} from "./live-serviceSearch-client"

export interface ServiceSearchClient {
  searchService(odsCode: string, logger: Logger): Promise<URL | undefined>
}

export class SandboxServiceSearchClient implements ServiceSearchClient {
  async searchService(): Promise<URL | undefined> {
    // This is not implemented as sandbox lambda does not use this code
    throw new Error("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  }
}

export function createServiceSearchClient(logger: Logger): ServiceSearchClient {
  const liveMode = process.env.TargetServiceSearchServer !== "sandbox"
  if (liveMode) {
    return new LiveServiceSearchClient(logger)
  } else {
    return new SandboxServiceSearchClient()
  }
}
