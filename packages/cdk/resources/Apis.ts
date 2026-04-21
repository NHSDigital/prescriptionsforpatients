import {HttpMethod} from "aws-cdk-lib/aws-lambda"
import {
  ExpressStateMachine,
  LambdaEndpoint,
  RestApiGateway,
  StateMachineEndpoint,
  TypescriptLambdaFunction
} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"

export interface ApisProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly mutualTlsTrustStoreKey: string | undefined
  functions: {
    status: TypescriptLambdaFunction
  }
  stateMachines: {
    getMyPrescriptions: ExpressStateMachine
  }
  readonly forwardCsocLogs: boolean
  readonly csocApiGatewayDestination: string
}

export class Apis extends Construct {

  public constructor(scope: Construct, id: string, props: ApisProps){
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

    new StateMachineEndpoint(this, "GetMyPrescriptionsEndpoint", {
      parentResource: rootResource,
      resourceName: "Bundle",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      stateMachine: props.stateMachines.getMyPrescriptions
    })

    new LambdaEndpoint(this, "StatusEndpoint", {
      parentResource: rootResource,
      resourceName: "_status",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      lambdaFunction: props.functions.status
    })

  }
}
