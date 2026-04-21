import {Stack, App} from "aws-cdk-lib"
import {StandardStackProps} from "@nhsdigital/eps-cdk-constructs"
import {SandboxFunctions} from "../resources/SandboxFunctions"
import {SandboxApis} from "../resources/SandboxApis"
import {nagSuppressions} from "../nagSuppressions"

export interface PfPApiSandboxStackProps extends StandardStackProps {
  readonly stackName: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly logRetentionInDays: number
  readonly logLevel: string
  readonly mutualTlsTrustStoreKey: string | undefined
}

export class PfPApiSandboxStack extends Stack {

  public constructor(scope: App, id: string, props: PfPApiSandboxStackProps){
    super(scope, id, props)

    const functions = new SandboxFunctions(this, "Functions", {
      stackName: props.stackName,
      version: props.version,
      commitId: props.commitId,
      targetSpineServer: props.targetSpineServer,
      targetServiceSearchServer: props.targetServiceSearchServer,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel
    })

    new SandboxApis(this, "Apis", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      mutualTlsTrustStoreKey: props.mutualTlsTrustStoreKey,
      // CSOC API GW log destination - do not change
      csocApiGatewayDestination: "arn:aws:logs:eu-west-2:693466633220:destination:api_gateway_log_destination",
      forwardCsocLogs: false,
      functions: functions.functions
    })

    nagSuppressions(this)
  }
}
