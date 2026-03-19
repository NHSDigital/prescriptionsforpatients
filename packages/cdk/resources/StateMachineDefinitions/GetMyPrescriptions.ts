import {IFunction} from "aws-cdk-lib/aws-lambda"
import {
  Chain,
  Choice,
  Condition,
  IChainable,
  Pass,
  TaskInput
} from "aws-cdk-lib/aws-stepfunctions"
import {LambdaInvoke} from "aws-cdk-lib/aws-stepfunctions-tasks"
import {CatchAllErrorPass} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"

export interface DefinitionProps {
  readonly getMyPrescriptionsFunction: IFunction
  readonly enrichPrescriptionsFunction: IFunction
  readonly getStatusUpdatesFunction: IFunction
}

export class GetMyPrescriptions extends Construct {
  public readonly definition: IChainable

  public constructor(scope: Construct, id: string, props: DefinitionProps){
    super(scope, id)

    const catchAllError = new CatchAllErrorPass(this, "Catch All Error")

    const getMyPrescriptions = new LambdaInvoke(this, "Get My Prescriptions", {
      lambdaFunction: props.getMyPrescriptionsFunction,
      payload: TaskInput.fromJsonPathAt("$")
    })
    getMyPrescriptions.addCatch(catchAllError.state)

    const failedGetMyPrescriptions = new Pass(this, "Failed Get My Prescriptions")

    const parseGetMyPrescriptionsBody = new Pass(this, "Parse Get My Prescriptions Body", {
      parameters: {
        "body.$": "States.StringToJson($.Payload.body)"
      },
      outputPath: "$.body"
    })

    const enrichPrescriptions = new LambdaInvoke(this, "Enrich Prescriptions", {
      lambdaFunction: props.enrichPrescriptionsFunction,
      payload: TaskInput.fromJsonPathAt("$")
    })
    enrichPrescriptions.addCatch(catchAllError.state)

    const getStatusUpdates = new LambdaInvoke(this, "Get Status Updates", {
      lambdaFunction: props.getStatusUpdatesFunction,
      payload: TaskInput.fromJsonPathAt("$.statusUpdateData"),
      resultSelector: {
        "Payload.$": "$.Payload"
      },
      resultPath: "$.StatusUpdates"
    })
    getStatusUpdates.addCatch(enrichPrescriptions, {
      resultPath: "$.error"
    })

    const checkGetMyPrescriptionsResult = new Choice(this, "Get My Prescriptions Result")
    const evaluateToggleGetStatusUpdates = new Choice(this, "Evaluate Toggle Get Status Updates Parameter")

    const getMyPrescriptionsSucceeded = Condition.numberEquals("$.Payload.statusCode", 200)
    const getStatusUpdatesEnabled = Condition.booleanEquals("$.getStatusUpdates", true)

    this.definition = Chain
      .start(getMyPrescriptions)
      .next(checkGetMyPrescriptionsResult
        .when(Condition.not(getMyPrescriptionsSucceeded), failedGetMyPrescriptions)
        .otherwise(parseGetMyPrescriptionsBody
          .next(evaluateToggleGetStatusUpdates
            .when(getStatusUpdatesEnabled, getStatusUpdates.next(enrichPrescriptions))
            .otherwise(enrichPrescriptions))))
  }
}
