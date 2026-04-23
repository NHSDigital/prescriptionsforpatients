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

    const createGetMyPrescriptions = () => {
      const getMyPrescriptions = LambdaInvoke.jsonata(this, "Get My Prescriptions", {
        lambdaFunction: props.getMyPrescriptionsFunction,
        payload: TaskInput.fromText("{% $states.input %}")
      })
      getMyPrescriptions.addCatch(catchAllError.state)
      return getMyPrescriptions
    }

    const createEnrichPrescriptions = () => {
      const enrichPrescriptions = LambdaInvoke.jsonata(this, "Enrich Prescriptions", {
        lambdaFunction: props.enrichPrescriptionsFunction,
        payload: TaskInput.fromText("{% $states.input %}")
      })
      enrichPrescriptions.addCatch(catchAllError.state)
      return enrichPrescriptions
    }

    const createGetStatusUpdates = (catchTarget: IChainable) => {
      const getStatusUpdates = LambdaInvoke.jsonata(this, "Get Status Updates", {
        lambdaFunction: props.getStatusUpdatesFunction,
        payload: TaskInput.fromText("{% $states.input.statusUpdateData %}"),
        outputs: "{% $merge([$states.input, {'StatusUpdates': {'Payload': $states.result.Payload}}]) %}"
      })
      getStatusUpdates.addCatch(catchTarget, {
        outputs: "{% $merge([$states.input, {'error': $states.errorOutput}]) %}"
      })
      return getStatusUpdates
    }

    const enrichPrescriptions = createEnrichPrescriptions()

    this.definition = Chain.start(createGetMyPrescriptions())
      .next(Choice.jsonata(this, "Get My Prescriptions Result")
        .when(
          Condition.jsonata("{% $states.input.Payload.statusCode != 200 %}"),
          new Pass(this, "Failed Get My Prescriptions")
        )
        .otherwise(Pass
          .jsonata(this, "Parse Get My Prescriptions Body", {
            outputs: "{% $parse($states.input.Payload.body) %}"
          })
          .next(Choice.jsonata(this, "Evaluate Toggle Get Status Updates Parameter")
            .when(
              Condition.jsonata("{% $states.input.getStatusUpdates = true %}"),
              createGetStatusUpdates(enrichPrescriptions).next(enrichPrescriptions)
            )
            .otherwise(enrichPrescriptions)
          )
        )
      )
  }
}
