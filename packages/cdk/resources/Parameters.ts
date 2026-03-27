import {ManagedPolicy} from "aws-cdk-lib/aws-iam"
import {Construct} from "constructs"
import {
  SsmParameterDefinition,
  SsmParametersConstruct,
  SsmParametersConstructProps
} from "@nhsdigital/eps-cdk-constructs"

export interface ParametersProps {
  readonly stackName: string
  readonly tc007NhsNumberValue: string
  readonly tc008NhsNumberValue: string
  readonly tc009NhsNumberValue: string
}

export class Parameters extends Construct {
  public readonly readParametersPolicy: ManagedPolicy

  public constructor(scope: Construct, id: string, props: ParametersProps) {
    super(scope, id)

    const parameterDefinitions: Array<SsmParameterDefinition> = [
      {
        id: "TC007NHSNumberParameter",
        nameSuffix: "TC007NHSNumber",
        description: "List of NHS numbers that will trigger 'temporarily unavailable' response for testing purposes.",
        value: props.tc007NhsNumberValue
      },
      {
        id: "TC008NHSNumberParameter",
        nameSuffix: "TC008NHSNumber",
        description: "List of NHS numbers that will trigger '500 system error' response for testing purposes.",
        value: props.tc008NhsNumberValue
      },
      {
        id: "TC009NHSNumberParameter",
        nameSuffix: "TC009NHSNumber",
        description:
          "List of NHS numbers that will trigger 'one or more prescriptions missing' response for testing purposes.",
        value: props.tc009NhsNumberValue
      }
    ]

    const ssmParametersProps: SsmParametersConstructProps = {
      namePrefix: props.stackName,
      parameters: parameterDefinitions,
      readPolicyDescription: "Allows reading SSM parameters"
    }

    const ssmParameters = new SsmParametersConstruct(this, "PfPApiSsmParameters", ssmParametersProps)
    this.readParametersPolicy = ssmParameters.readParametersPolicy
  }
}
