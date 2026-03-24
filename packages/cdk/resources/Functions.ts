import {Fn, RemovalPolicy} from "aws-cdk-lib"
import {ManagedPolicy} from "aws-cdk-lib/aws-iam"
import {Construct} from "constructs"
import {TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Code, LayerVersion} from "aws-cdk-lib/aws-lambda"
import {join, resolve} from "node:path"

export interface FunctionsProps {
  readonly stackName: string
  readonly version: string
  readonly commitId: string
  readonly deploymentEnvironment: string
  readonly targetSpineServer: string
  readonly targetServiceSearchServer: string
  readonly toggleGetStatusUpdates: string
  readonly allowNhsNumberOverride: string
  readonly logRetentionInDays: number
  readonly logLevel: string
  readonly getPfPParametersPolicy: ManagedPolicy
}

const baseDir = resolve(__dirname, "../../..")

export class Functions extends Construct {
  functions: {[key: string]: TypescriptLambdaFunction}

  public constructor(scope: Construct, id: string, props: FunctionsProps) {
    super(scope, id)

    // Imports
    const lambdaAccessSecretsPolicy = ManagedPolicy.fromManagedPolicyArn(
      this, "lambdaAccessSecretsPolicy", Fn.importValue("account-resources:LambdaAccessSecretsPolicy"))

    const lambdaDecryptSecretsKMSPolicy = ManagedPolicy.fromManagedPolicyArn(
      this, "lambdaDecryptSecretsKMSPolicy", Fn.importValue("account-resources:LambdaDecryptSecretsKMSPolicy"))

    const lambdaDefaultEnvironmentVariables: {[key: string]: string} = {
      STACK_NAME: props.stackName,
      TargetSpineServer: props.targetSpineServer,
      TargetServiceSearchServer: props.targetServiceSearchServer,
      SpinePrivateKeyARN: Fn.importValue("account-resources:SpinePrivateKey"),
      SpinePublicCertificateARN: Fn.importValue("account-resources:SpinePublicCertificate"),
      SpineASIDARN: Fn.importValue("account-resources:SpineASID"),
      SpinePartyKeyARN: Fn.importValue("account-resources:SpinePartyKey"),
      SpineCAChainARN: Fn.importValue("account-resources:SpineCAChain"),
      ServiceSearch3ApiKeyARN: Fn.importValue("pfp-PfP-ServiceSearch-API-Key")
    }

    const getSecretsLambdaLayer = new LayerVersion(this, "GetSecretsLambdaLayer", {
      description: "get secrets layer",
      code: Code.fromAsset(join(baseDir, "packages/getSecretLayer/lib/get-secrets-layer.zip")),
      removalPolicy: RemovalPolicy.RETAIN
    })

    // Resources
    const getMyPrescriptionsLambda = new TypescriptLambdaFunction(this, "GetMyPrescriptionsLambda", {
      functionName: `${props.stackName}-GetMyPrescriptions`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/getMyPrescriptions",
      entryPoint: "src/getMyPrescriptions.ts",
      environmentVariables: {
        ...lambdaDefaultEnvironmentVariables,
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/get-secrets-layer",
        DEPLOYMENT_ENVIRONMENT: props.deploymentEnvironment,
        GET_STATUS_UPDATES: props.toggleGetStatusUpdates,
        ALLOW_NHS_NUMBER_OVERRIDE: props.allowNhsNumberOverride
      },
      layers: [getSecretsLambdaLayer],
      additionalPolicies: [
        lambdaAccessSecretsPolicy,
        lambdaDecryptSecretsKMSPolicy,
        props.getPfPParametersPolicy
      ],
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    const enrichPrescriptionsLambda = new TypescriptLambdaFunction(this, "EnrichPrescriptionsLambda", {
      functionName: `${props.stackName}-EnrichPrescriptions`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/enrichPrescriptions",
      entryPoint: "src/enrichPrescriptions.ts",
      environmentVariables: {
        ...lambdaDefaultEnvironmentVariables,
        DEPLOYMENT_ENVIRONMENT: props.deploymentEnvironment,
        EXPECT_STATUS_UPDATES: props.toggleGetStatusUpdates
      },
      additionalPolicies: [
        props.getPfPParametersPolicy
      ],
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
        ...lambdaDefaultEnvironmentVariables,
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/get-secrets-layer"
      },
      layers: [getSecretsLambdaLayer],
      additionalPolicies: [lambdaAccessSecretsPolicy, lambdaDecryptSecretsKMSPolicy],
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    this.functions = {
      getMyPrescriptions: getMyPrescriptionsLambda,
      enrichPrescriptions: enrichPrescriptionsLambda,
      status: statusLambda
    }
  }
}
