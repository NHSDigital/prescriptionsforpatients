import {HttpMethod} from "aws-cdk-lib/aws-lambda"
import {
  ExpressStateMachine,
  LambdaEndpoint,
  RestApiGateway,
  TypescriptLambdaFunction
} from "@nhsdigital/eps-cdk-constructs"
import {StateMachineEndpoint} from "@nhsdigital/eps-cdk-constructs/lib/src/constructs/RestApiGateway/StateMachineEndpoint.js"
import {Construct} from "constructs"

export interface ApisProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly mutualTlsTrustStoreKey: string | undefined
  functions: {[key: string]: TypescriptLambdaFunction}
  stateMachines: {[key: string]: ExpressStateMachine}
  readonly forwardCsocLogs: boolean
  readonly csocApiGatewayDestination: string
}

export class Apis extends Construct {
  apis: {[key: string]: RestApiGateway}
  endpoints: {[key: string]: Construct}

  public constructor(scope: Construct, id: string, props: ApisProps) {
    super(scope, id)

    const apiGateway = new RestApiGateway(this, "ApiGateway", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      mutualTlsTrustStoreKey: props.mutualTlsTrustStoreKey,
      forwardCsocLogs: props.forwardCsocLogs,
      csocApiGatewayDestination: props.csocApiGatewayDestination,
      executionPolicies: [
        props.stateMachines.getMyPrescriptions.executionPolicy,
        props.functions.status.executionPolicy
      ]
    })
    const rootResource = apiGateway.api.root

    const getMyPrescriptionsEndpoint = new StateMachineEndpoint(this, "GetMyPrescriptionsEndpoint", {
      parentResource: rootResource,
      resourceName: "Bundle",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      stateMachine: props.stateMachines.getMyPrescriptions
    })

    const statusEndpoint = new LambdaEndpoint(this, "StatusEndpoint", {
      parentResource: rootResource,
      resourceName: "_status",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      lambdaFunction: props.functions.status
    })

    this.apis = {
      api: apiGateway
    }
    this.endpoints = {
      getMyPrescriptions: getMyPrescriptionsEndpoint,
      status: statusEndpoint
    }
  }
}
