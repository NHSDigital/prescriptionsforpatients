import {ServiceSearchResponse} from "./live-serviceSearch-client"
import {ServiceSearchClient} from "./serviceSearch-client"
import {StatusCheckResponse} from "./status"

export class SandboxServiceSearchClient implements ServiceSearchClient {
  async getStatus(): Promise<StatusCheckResponse> {
    return {
      status: "pass",
      timeout: "false",
      responseCode: 200
    }
  }

  async searchService(): Promise<ServiceSearchResponse> {
    // This is not implemented as sandbox lambda does not use this code
    throw new Error("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  }

  isKeyConfigured(): boolean {
    // In the sandbox environment, assume the certificate is always configured
    return true
  }
}
