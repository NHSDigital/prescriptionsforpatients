import {App, Stack} from "aws-cdk-lib"
import {nagSuppressions} from "../nagSuppressions"
import {Functions} from "../resources/Functions"
import {Parameters} from "../resources/Parameters"
import {StateMachines} from "../resources/StateMachines"
import {Apis} from "../resources/Apis"
import {StandardStackProps} from "@nhsdigital/eps-cdk-constructs"

export interface PfPApiStackProps extends StandardStackProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly logLevel: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly toggleGetStatusUpdates: string
  readonly allowNhsNumberOverride: string
  readonly tc007NhsNumberValue: string
  readonly tc008NhsNumberValue: string
  readonly tc009NhsNumberValue: string
  readonly mutualTlsTrustStoreKey: string | undefined
  readonly csocApiGatewayDestination: string
  readonly forwardCsocLogs: boolean
}

export class PfPApiStack extends Stack {
  public constructor(scope: App, id: string, props: PfPApiStackProps) {
    super(scope, id, props)

    const params = new Parameters(this, "Parameters", {
      stackName: props.stackName,
      tc007NhsNumberValue: props.tc007NhsNumberValue,
      tc008NhsNumberValue: props.tc008NhsNumberValue,
      tc009NhsNumberValue: props.tc009NhsNumberValue
    })

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
      getPfPParametersPolicy: params.readParametersPolicy
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
