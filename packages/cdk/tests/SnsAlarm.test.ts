import {App, Duration, Stack} from "aws-cdk-lib"
import {Template} from "aws-cdk-lib/assertions"
import {ComparisonOperator, Unit} from "aws-cdk-lib/aws-cloudwatch"
import {Topic} from "aws-cdk-lib/aws-sns"
import {describe, expect, it} from "vitest"
import {SnsAlarm} from "../constructs/SnsAlarm"

const importedSlackTopicArn = "arn:aws:sns:eu-west-2:111111111111:SlackAlertsTopic"

describe("SnsAlarm construct", () => {
  it("applies sane defaults for simple alarm definitions", () => {
    const app = new App()
    const stack = new Stack(app, "TestStack")
    const slackAlertTopic = Topic.fromTopicArn(stack, "SlackAlertsTopic", importedSlackTopicArn)

    const metricAlarm = new SnsAlarm(stack, "SimpleMetricAlarm", {
      stackName: "pfp-test-stack",
      enableAlerts: true,
      alarmDefinition: {
        alarmName: "MySimpleAlarm",
        alarmDescription: "An alarm for any breach (threshold 1) in a single period"
      },
      metricStatConfig: {
        namespace: "LambdaLogFilterMetrics",
        metricName: "ErrorCount"
      },
      slackAlertTopic
    })

    expect(metricAlarm.alarm).toBeDefined()

    const template = Template.fromStack(stack)
    template.resourceCountIs("AWS::SNS::Topic", 0)

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
      AlarmDescription: "An alarm for any breach (threshold 1) in a single period",
      ActionsEnabled: true
    })
  })

  it("allows overriding threshold, comparison operator, unit and dimensions", () => {
    const app = new App()
    const stack = new Stack(app, "OverrideStack")
    const slackAlertTopic = Topic.fromTopicArn(stack, "SlackAlertsTopic", importedSlackTopicArn)

    const metricAlarm = new SnsAlarm(stack, "OverrideMetricAlarm", {
      stackName: "pfp-test-stack",
      enableAlerts: false,
      alarmDefinition: {
        alarmName: "MyOverrideAlarm",
        alarmDescription: "Override alarm",
        threshold: 250,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1
      },
      metricStatConfig: {
        namespace: "CustomNamespace",
        metricName: "Latency",
        unitFilter: Unit.MILLISECONDS,
        dimensions: [
          {
            name: "FunctionName",
            value: "my-function"
          }
        ],
        period: Duration.minutes(1),
        statistic: "Sum"
      },
      slackAlertTopic
    })

    expect(metricAlarm.alarm).toBeDefined()

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
