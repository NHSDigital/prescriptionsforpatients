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

    const parseGetMyPrescriptionsBody = Pass.jsonata(this, "Parse Get My Prescriptions Body", {
      outputs: "{% $parse($states.input.Payload.body) %}"
    })

    const enrichPrescriptions = new LambdaInvoke(this, "Enrich Prescriptions", {
      lambdaFunction: props.enrichPrescriptionsFunction,
      payload: TaskInput.fromJsonPathAt("$")
    })
    enrichPrescriptions.addCatch(catchAllError.state)

    const getStatusUpdates = LambdaInvoke.jsonata(this, "Get Status Updates", {
      lambdaFunction: props.getStatusUpdatesFunction,
      payload: TaskInput.fromText("{% $states.input.statusUpdateData %}"),
      outputs: "{% $merge([$states.input, {'StatusUpdates': {'Payload': $states.result.Payload}}]) %}"
    })
    getStatusUpdates.addCatch(enrichPrescriptions, {
      outputs: "{% $merge([$states.input, {'error': $states.errorOutput}]) %}"
    })

    const checkGetMyPrescriptionsResult = Choice.jsonata(this, "Get My Prescriptions Result")
    const evaluateToggleGetStatusUpdates = Choice.jsonata(this, "Evaluate Toggle Get Status Updates Parameter")

    this.definition = Chain
      .start(getMyPrescriptions)
      .next(checkGetMyPrescriptionsResult
        .when(Condition.jsonata("{% $states.input.Payload.statusCode != 200 %}"), failedGetMyPrescriptions)
        .otherwise(parseGetMyPrescriptionsBody
          .next(evaluateToggleGetStatusUpdates
            .when(
              Condition.jsonata("{% $states.input.getStatusUpdates = true %}"),
              getStatusUpdates.next(enrichPrescriptions)
            )
            .otherwise(enrichPrescriptions))))
  }
}
