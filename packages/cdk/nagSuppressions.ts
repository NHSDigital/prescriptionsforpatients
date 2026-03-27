/* eslint-disable max-len */
import {Stack} from "aws-cdk-lib"
import {safeAddNagSuppressionGroup, safeAddNagSuppression} from "@nhsdigital/eps-cdk-constructs"

export const nagSuppressions = (stack: Stack) => {
  safeAddNagSuppressionGroup(
    stack,
    [
      "/PfPApiStack/Functions/GetMyPrescriptionsLambda/LambdaPutLogsManagedPolicy/Resource",
      "/PfPApiStack/Functions/EnrichPrescriptionsLambda/LambdaPutLogsManagedPolicy/Resource",
      "/PfPApiStack/Functions/StatusLambda/LambdaPutLogsManagedPolicy/Resource",
      "/PfPApiStack/StateMachines/GetMyPrescriptionsStateMachine/StateMachinePutLogsManagedPolicy/Resource"
    ],
    [
      {
        id: "AwsSolutions-IAM5",
        reason: "Suppress error for not having wildcards in permissions. This is a fine as we need to have permissions on all log streams under path"
      }
    ]
  )

  safeAddNagSuppression(
    stack,
    "/PfPApiStack/Apis/ApiGateway/ApiGateway/Resource",
    [
      {
        id: "AwsSolutions-APIG2",
        reason: "Suppress error for request validation not being enabled. Validation will be handled by the service logic."
      }
    ]
  )

  safeAddNagSuppressionGroup(
    stack,
    [
      "/PfPApiStack/Apis/ApiGateway/ApiGateway/Default/Bundle/GET/Resource",
      "/PfPApiStack/Apis/ApiGateway/ApiGateway/Default/_status/GET/Resource"
    ],
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
