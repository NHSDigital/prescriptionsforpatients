import {App, Fn, Stack} from "aws-cdk-lib"
import {ManagedPolicy} from "aws-cdk-lib/aws-iam"
import {nagSuppressions} from "../nagSuppressions"
import {Functions} from "../resources/Functions"
import {StateMachines} from "../resources/StateMachines"
import {Apis} from "../resources/Apis"
import {StandardStackProps} from "@nhsdigital/eps-cdk-constructs"

export interface PfPApiStatelessStackProps extends StandardStackProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly logLevel: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly toggleGetStatusUpdates: string
  readonly allowNhsNumberOverride: string
  readonly mutualTlsTrustStoreKey: string | undefined
  readonly csocApiGatewayDestination: string
  readonly forwardCsocLogs: boolean
  readonly parametersReadPolicyExportName: string
}

export class PfPApiStatelessStack extends Stack {
  public constructor(scope: App, id: string, props: PfPApiStatelessStackProps) {
    super(scope, id, props)

    const parametersReadPolicy = ManagedPolicy.fromManagedPolicyArn(
      this,
      "ReadParametersPolicy",
      Fn.importValue(props.parametersReadPolicyExportName)
    )

    // Resources
    const functions = new Functions(this, "Functions", {
      stackName: props.stackName,
      version: props.version,
      commitId: props.commitId,
      deploymentEnvironment: props.environment,
      targetSpineServer: props.targetSpineServer,
      targetServiceSearchServer: props.targetServiceSearchServer,
      toggleGetStatusUpdates: props.toggleGetStatusUpdates,
      allowNhsNumberOverride: props.allowNhsNumberOverride,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      getPfPParametersPolicy: parametersReadPolicy
    })

    const stateMachines = new StateMachines(this, "StateMachines", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      functions: functions.functions
    })

    new Apis(this, "Apis", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      mutualTlsTrustStoreKey: props.mutualTlsTrustStoreKey,
      functions: functions.functions,
      stateMachines: stateMachines.stateMachines,
      csocApiGatewayDestination: props.csocApiGatewayDestination,
      forwardCsocLogs: props.forwardCsocLogs
    })

    nagSuppressions(this)
  }
}
