/* eslint-disable max-len */
import {Stack} from "aws-cdk-lib"
import {safeAddNagSuppressionGroup, safeAddNagSuppression} from "@nhsdigital/eps-cdk-constructs"

export const nagSuppressions = (stack: Stack) => {
  const stackPath = `/${stack.node.id}`
  const isSandboxStack = stack.node.id === "PfPApiSandboxStack"

  const lambdaManagedPolicyPaths = isSandboxStack
    ? [
      `${stackPath}/Functions/SandboxLambda/LambdaPutLogsManagedPolicy/Resource`,
      `${stackPath}/Functions/CapabilityStatementLambda/LambdaPutLogsManagedPolicy/Resource`,
      `${stackPath}/Functions/StatusLambda/LambdaPutLogsManagedPolicy/Resource`
    ]
    : [
      `${stackPath}/Functions/GetMyPrescriptionsLambda/LambdaPutLogsManagedPolicy/Resource`,
      `${stackPath}/Functions/EnrichPrescriptionsLambda/LambdaPutLogsManagedPolicy/Resource`,
      `${stackPath}/Functions/StatusLambda/LambdaPutLogsManagedPolicy/Resource`,
      `${stackPath}/StateMachines/GetMyPrescriptionsStateMachine/StateMachinePutLogsManagedPolicy/Resource`
    ]

  safeAddNagSuppressionGroup(
    stack,
    lambdaManagedPolicyPaths,
    [
      {
        id: "AwsSolutions-IAM5",
        reason: "Suppress error for not having wildcards in permissions. This is a fine as we need to have permissions on all log streams under path"
      }
    ]
  )

  safeAddNagSuppression(
    stack,
    `${stackPath}/Apis/ApiGateway/ApiGateway/Resource`,
    [
      {
        id: "AwsSolutions-APIG2",
        reason: "Suppress error for request validation not being enabled. Validation will be handled by the service logic."
      }
    ]
  )

  const unauthorisedEndpointPaths = isSandboxStack
    ? [
      `${stackPath}/Apis/ApiGateway/ApiGateway/Default/Bundle/GET/Resource`,
      `${stackPath}/Apis/ApiGateway/ApiGateway/Default/metadata/GET/Resource`,
      `${stackPath}/Apis/ApiGateway/ApiGateway/Default/_status/GET/Resource`
    ]
    : [
      `${stackPath}/Apis/ApiGateway/ApiGateway/Default/Bundle/GET/Resource`,
      `${stackPath}/Apis/ApiGateway/ApiGateway/Default/_status/GET/Resource`
    ]

  safeAddNagSuppressionGroup(
    stack,
    unauthorisedEndpointPaths,
    [
      {
        id: "AwsSolutions-APIG4",
        reason: "Suppress error for not implementing authorization. Token endpoint should not have an authorizer"
      },
      {
        id: "AwsSolutions-COG4",
        reason: "Suppress error for not implementing a Cognito user pool authorizer. Token endpoint should not have an authorizer"
      }
    ]
  )

}
