import {AxiosResponse} from "axios"
import {SpineClient} from "./spine-client"
import {StatusCheckResponse} from "./status"

export class SandboxSpineClient implements SpineClient {
  async getStatus(): Promise<StatusCheckResponse> {
    return {
      status: "pass",
      timeout: "false",
      responseCode: 200
    }
  }

  async getPrescriptions(): Promise<AxiosResponse> {
    // This is not implemented as sandbox lambda does not use this code
    throw new Error("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  }

  isCertificateConfigured(): boolean {
    // In the sandbox environment, assume the certificate is always configured
    return true
  }
}
