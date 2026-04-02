import {App, Stack} from "aws-cdk-lib"
import {Template} from "aws-cdk-lib/assertions"
import {ComparisonOperator, Unit} from "aws-cdk-lib/aws-cloudwatch"
import {Topic} from "aws-cdk-lib/aws-sns"
import {describe, expect, it} from "vitest"
import {MetricAlarm} from "../constructs/MetricAlarm"

describe("MetricAlarm construct", () => {
  it("applies sane defaults for simple alarm definitions", () => {
    const app = new App()
    const stack = new Stack(app, "TestStack")
    const slackAlertTopic = new Topic(stack, "SlackAlertsTopic")

    new MetricAlarm(stack, "SimpleMetricAlarm", {
      stackName: "pfp-test-stack",
      enableAlerts: true,
      namespace: "LambdaLogFilterMetrics",
      alarmDefinition: {
        name: "MySimpleAlarm",
        metric: "ErrorCount",
        description: "Simple alarm"
      },
      slackAlertTopic
    })

    const template = Template.fromStack(stack)

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "pfp-test-stack-MySimpleAlarm",
      Namespace: "LambdaLogFilterMetrics",
      MetricName: "ErrorCount",
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      Unit: "Count",
      Statistic: "Sum",
      Period: 60,
      EvaluationPeriods: 1,
      TreatMissingData: "notBreaching",
      AlarmDescription: "Simple alarm",
      ActionsEnabled: true
    })
  })

  it("allows overriding threshold, comparison operator, unit and dimensions", () => {
    const app = new App()
    const stack = new Stack(app, "OverrideStack")
    const slackAlertTopic = new Topic(stack, "SlackAlertsTopic")

    const metricAlarm = new MetricAlarm(stack, "OverrideMetricAlarm", {
      stackName: "pfp-test-stack",
      enableAlerts: false,
      namespace: "CustomNamespace",
      alarmDefinition: {
        name: "MyOverrideAlarm",
        metric: "Latency",
        description: "Override alarm",
        dimensions: {
          FunctionName: "my-function"
        },
        threshold: 250,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        unit: Unit.MILLISECONDS
      },
      slackAlertTopic
    })

    expect(metricAlarm.alarms.MyOverrideAlarm).toBeDefined()

    const template = Template.fromStack(stack)

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "pfp-test-stack-MyOverrideAlarm",
      Namespace: "CustomNamespace",
      MetricName: "Latency",
      Threshold: 250,
      ComparisonOperator: "GreaterThanThreshold",
      Unit: "Milliseconds",
      Dimensions: [
        {
          Name: "FunctionName",
          Value: "my-function"
        }
      ],
      AlarmDescription: "Override alarm",
      ActionsEnabled: false
    })
  })
})
