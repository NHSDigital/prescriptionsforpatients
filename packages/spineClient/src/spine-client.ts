import {ClientRequest, SpineResponse} from "./models/spine"
import {Logger} from "@aws-lambda-powertools/logger"
import {StatusCheckResponse} from "./status"
import {LiveSpineClient} from "./live-spine-client"
import {SandboxSpineClient} from "./sandbox-spine-client"

export interface SpineClient {
  send(request: ClientRequest, logger: Logger): Promise<SpineResponse<unknown>>
  getStatus(logger: Logger): Promise<StatusCheckResponse>
}

export function createSpineClient(
  spinePrivateKey: string,
  spinePublicCertificate: string,
  spineASID: string,
  spineCAChain: string
): SpineClient {
  const liveMode = process.env.TargetSpineServer !== "sandbox"
  if (liveMode) {
    return new LiveSpineClient(spinePrivateKey, spinePublicCertificate, spineASID, spineCAChain)
  } else {
    return new SandboxSpineClient()
  }
}
