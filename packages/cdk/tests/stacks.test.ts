import {App} from "aws-cdk-lib"
import {Template} from "aws-cdk-lib/assertions"
import {describe, it} from "vitest"
import {PfPApiSandboxStack, PfPApiSandboxStackProps} from "../stacks/PfPApiSandboxStack"
import {PfPApiStack, PfPApiStackProps} from "../stacks/PfPApiStack"

function createStandardStackProps() {
  return {
    commitId: "test-commit",
    env: {
      region: "eu-west-2"
    },
    environment: "test",
    isPullRequest: true,
    version: "0.0.0-test"
  }
}

function createMainStackProps(): PfPApiStackProps {
  return {
    ...createStandardStackProps(),
    allowNhsNumberOverride: "false",
    csocApiGatewayDestination: "arn:aws:logs:eu-west-2:693466633220:destination:api_gateway_log_destination",
    enableAlerts: true,
    forwardCsocLogs: false,
    logLevel: "INFO",
    logRetentionInDays: 7,
    mutualTlsTrustStoreKey: undefined,
    serviceSearchApiKeySecretName: "pfp-PfP-ServiceSearch-API-Key",
    stackName: "pfp-test-stack",
    targetServiceSearchServer: "https://live/service-search-api/",
    targetSpineServer: "https://example-spine.test",
    tc007NhsNumberValue: "9000000009",
    tc008NhsNumberValue: "9000000017",
    tc009NhsNumberValue: "9000000025",
    toggleGetStatusUpdates: "true"
  }
}

function createSandboxStackProps(): PfPApiSandboxStackProps {
  return {
    ...createStandardStackProps(),
    logLevel: "INFO",
    logRetentionInDays: 30,
    mutualTlsTrustStoreKey: undefined,
    stackName: "pfp-sandbox",
    targetServiceSearchServer: "https://sandbox/service-search-api/",
    targetSpineServer: "https://example-spine.test"
  }
}

describe("CDK stack synthesis", () => {
  it("synthesizes the main stack with the core API resources", () => {
    const app = new App()
    const stack = new PfPApiStack(app, "TestPfPApiStack", createMainStackProps())
    const template = Template.fromStack(stack)

    template.resourceCountIs("AWS::ApiGateway::RestApi", 1)
    template.resourceCountIs("AWS::CloudWatch::Alarm", 4)
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 1)

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmDescription: "Count of Service Search errors",
      AlarmName: "pfp-test-stack-ServiceSearch_Errors",
      ActionsEnabled: true
    })

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "pfp-test-stack-GetMyPrescriptions"
    })
  })

  it("synthesizes the sandbox stack with its public endpoints", () => {
    const app = new App()
    const stack = new PfPApiSandboxStack(app, "TestPfPApiSandboxStack", createSandboxStackProps())
    const template = Template.fromStack(stack)

    template.resourceCountIs("AWS::ApiGateway::RestApi", 1)
    template.resourceCountIs("AWS::Lambda::Function", 3)

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "pfp-sandbox-Sandbox"
    })

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "pfp-sandbox-CapabilityStatement"
    })
  })
})
