import {App, CfnOutput, Stack} from "aws-cdk-lib"
import {Parameters} from "../resources/Parameters"
import {StandardStackProps} from "@nhsdigital/eps-cdk-constructs"

export interface PfPApiStatefulStackProps extends StandardStackProps {
  readonly stackName: string
  readonly tc007NhsNumberValue: string
  readonly tc008NhsNumberValue: string
  readonly tc009NhsNumberValue: string
}

export function buildParametersReadPolicyExportName(stackName: string): string {
  return `${stackName}:PfPApi:ReadParametersPolicyArn`
}

export class PfPApiStatefulStack extends Stack {
  public constructor(scope: App, id: string, props: PfPApiStatefulStackProps) {
    super(scope, id, props)

    const params = new Parameters(this, "Parameters", {
      stackName: props.stackName,
      tc007NhsNumberValue: props.tc007NhsNumberValue,
      tc008NhsNumberValue: props.tc008NhsNumberValue,
      tc009NhsNumberValue: props.tc009NhsNumberValue
    })

    new CfnOutput(this, "ReadParametersPolicyArn", {
      value: params.readParametersPolicy.managedPolicyArn,
      exportName: buildParametersReadPolicyExportName(props.stackName)
    })
  }
}
