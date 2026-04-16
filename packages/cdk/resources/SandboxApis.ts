import {HttpMethod} from "aws-cdk-lib/aws-lambda"
import {LambdaEndpoint, RestApiGateway, TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"

export interface SandboxApisProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  readonly mutualTlsTrustStoreKey: string | undefined
  readonly csocApiGatewayDestination: string
  readonly forwardCsocLogs: boolean
  functions: {[key: string]: TypescriptLambdaFunction}
}

export class SandboxApis extends Construct {
  apis: {[key: string]: RestApiGateway}
  endpoints: {[key: string]: Construct}

  public constructor(scope: Construct, id: string, props: SandboxApisProps){
    super(scope, id)

    const apiGateway = new RestApiGateway(this, "ApiGateway", {
      stackName: props.stackName,
      logRetentionInDays: props.logRetentionInDays,
      mutualTlsTrustStoreKey: props.mutualTlsTrustStoreKey,
      forwardCsocLogs: props.forwardCsocLogs,
      csocApiGatewayDestination: props.csocApiGatewayDestination,
      executionPolicies: [
        props.functions.sandbox.executionPolicy,
        props.functions.capabilityStatement.executionPolicy,
        props.functions.status.executionPolicy
      ]
    })
    const rootResource = apiGateway.api.root

    const bundleEndpoint = new LambdaEndpoint(this, "SandboxBundleEndpoint", {
      parentResource: rootResource,
      resourceName: "Bundle",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      lambdaFunction: props.functions.sandbox
    })

    const capabilityStatementEndpoint = new LambdaEndpoint(this, "CapabilityStatementEndpoint", {
      parentResource: rootResource,
      resourceName: "metadata",
      method: HttpMethod.GET,
      restApiGatewayRole: apiGateway.role,
      lambdaFunction: props.functions.capabilityStatement
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
      sandbox: bundleEndpoint,
      capabilityStatement: capabilityStatementEndpoint,
      status: statusEndpoint
    }
  }
}
