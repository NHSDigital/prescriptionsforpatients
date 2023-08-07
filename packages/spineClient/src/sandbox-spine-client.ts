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
    throw new Error("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  }
}
