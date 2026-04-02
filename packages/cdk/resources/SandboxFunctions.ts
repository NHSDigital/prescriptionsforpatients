import {TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"
import {resolve} from "node:path"

export interface SandboxFunctionsProps {
  readonly stackName: string
  readonly version: string
  readonly commitId: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly logRetentionInDays: number
  readonly logLevel: string
}

const baseDir = resolve(__dirname, "../../..")

export class SandboxFunctions extends Construct {
  functions: {[key: string]: TypescriptLambdaFunction}

  public constructor(scope: Construct, id: string, props: SandboxFunctionsProps) {
    super(scope, id)

    const lambdaDefaultEnvironmentVariables: {[key: string]: string} = {
      STACK_NAME: props.stackName,
      TargetSpineServer: props.targetSpineServer,
      TargetServiceSearchServer: props.targetServiceSearchServer
    }

    const sandboxLambda = new TypescriptLambdaFunction(this, "SandboxLambda", {
      functionName: `${props.stackName}-Sandbox`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/nhsd-pfp-sandbox",
      entryPoint: "src/sandbox.ts",
      environmentVariables: {
        ...lambdaDefaultEnvironmentVariables
      },
      timeoutInSeconds: 30,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    const capabilityStatementLambda = new TypescriptLambdaFunction(this, "CapabilityStatementLambda", {
      functionName: `${props.stackName}-CapabilityStatement`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/capabilityStatement",
      entryPoint: "src/capabilityStatement.ts",
      environmentVariables: {
        ...lambdaDefaultEnvironmentVariables
      },
      timeoutInSeconds: 30,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    const statusLambda = new TypescriptLambdaFunction(this, "StatusLambda", {
      functionName: `${props.stackName}-status`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/statusLambda",
      entryPoint: "src/statusLambda.ts",
      environmentVariables: {
        ...lambdaDefaultEnvironmentVariables
      },
      timeoutInSeconds: 30,
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    this.functions = {
      sandbox: sandboxLambda,
      capabilityStatement: capabilityStatementLambda,
      status: statusLambda
    }
  }
}
