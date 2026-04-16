import {Fn} from "aws-cdk-lib"
import {ManagedPolicy, PolicyStatement} from "aws-cdk-lib/aws-iam"
import {Function} from "aws-cdk-lib/aws-lambda"
import {ExpressStateMachine, TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"
import {GetMyPrescriptions} from "./StateMachineDefinitions/GetMyPrescriptions"

export interface StateMachinesProps {
  readonly stackName: string
  readonly logRetentionInDays: number
  functions: {[key: string]: TypescriptLambdaFunction}
}

export class StateMachines extends Construct {
  stateMachines: {[key: string]: ExpressStateMachine}

  public constructor(scope: Construct, id: string, props: StateMachinesProps){
    super(scope, id)

    // Imports
    const getStatusUpdates = Function.fromFunctionArn(
      this, "GetStatusUpdates", `${Fn.importValue("psu:functions:GetStatusUpdates:FunctionArn")}:$LATEST`)
    const callGetStatusUpdatesManagedPolicy = new ManagedPolicy(this, "CallGetStatusUpdatesManagedPolicy", {
      description: "call get status updates lambda from get my prescriptions state machine",
      statements: [
        new PolicyStatement({
          actions: [
            "lambda:InvokeFunction"
          ],
          resources: [
            getStatusUpdates.functionArn
          ]
        })
      ]
    })

    const getMyPrescriptions = new GetMyPrescriptions(this, "GetMyPrescriptionsStateMachineDefinition", {
      getMyPrescriptionsFunction: props.functions.getMyPrescriptions.function,
      enrichPrescriptionsFunction: props.functions.enrichPrescriptions.function,
      getStatusUpdatesFunction: getStatusUpdates
    })
    const getMyPrescriptionsStateMachine = new ExpressStateMachine(this, "GetMyPrescriptionsStateMachine", {
      stackName: props.stackName,
      stateMachineName: `${props.stackName}-GetMyPrescriptions`,
      definition: getMyPrescriptions.definition,
      logRetentionInDays: props.logRetentionInDays,
      additionalPolicies: [
        props.functions.getMyPrescriptions.executionPolicy,
        props.functions.enrichPrescriptions.executionPolicy,
        callGetStatusUpdatesManagedPolicy
      ]
    })

    this.stateMachines = {
      getMyPrescriptions: getMyPrescriptionsStateMachine
    }
  }
}
