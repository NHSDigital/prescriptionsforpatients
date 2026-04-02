import {App, Stack} from "aws-cdk-lib"
import {nagSuppressions} from "../nagSuppressions"
import {Functions} from "../resources/Functions"
import {StateMachines} from "../resources/StateMachines"
import {Apis} from "../resources/Apis"
import {Alarms} from "../resources/Alarms"
import {StandardStackProps} from "@nhsdigital/eps-cdk-constructs"
import Parameters from "../resources/Parameters"

export interface PfPApiStackProps extends StandardStackProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly logLevel: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly serviceSearchApiKeySecretName: string
  readonly toggleGetStatusUpdates: string
  readonly allowNhsNumberOverride: string
  readonly tc007NhsNumberValue: string
  readonly tc008NhsNumberValue: string
  readonly tc009NhsNumberValue: string
  readonly mutualTlsTrustStoreKey: string | undefined
  readonly enableAlerts: boolean
  readonly csocApiGatewayDestination: string
  readonly forwardCsocLogs: boolean
}

export class PfPApiStack extends Stack {
  public constructor(scope: App, id: string, props: PfPApiStackProps){
    super(scope, id, props)

    // Resources
    const parameters = new Parameters(this, "SsmParameters", {
      stackName: props.stackName,
      tc007NhsNumberValue: props.tc007NhsNumberValue,
      tc008NhsNumberValue: props.tc008NhsNumberValue,
      tc009NhsNumberValue: props.tc009NhsNumberValue
    })

    const functions = new Functions(this, "Functions", {
      stackName: props.stackName,
      version: props.version,
      commitId: props.commitId,
      deploymentEnvironment: props.environment,
      targetSpineServer: props.targetSpineServer,
      targetServiceSearchServer: props.targetServiceSearchServer,
      toggleGetStatusUpdates: props.toggleGetStatusUpdates,
      serviceSearchApiKeySecretName: props.serviceSearchApiKeySecretName,
      allowNhsNumberOverride: props.allowNhsNumberOverride,
      getPfPParametersPolicy: parameters.readParametersPolicy,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel
    })

    const stateMachines = new StateMachines(this, "StateMachines", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      functions: functions.functions
    })

    new Alarms(this, "Alarms", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
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
