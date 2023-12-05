import {ServiceSearchClient} from "./serviceSearch-client"

export class SandboxServiceSearchClient implements ServiceSearchClient {
  async searchService(): Promise<URL | undefined> {
    // This is not implemented as sandbox lambda does not use this code
    throw new Error("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  }
}
