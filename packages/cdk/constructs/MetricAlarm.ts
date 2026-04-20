import {Duration} from "aws-cdk-lib"
import {Construct} from "constructs"
import {
  Alarm,
  ComparisonOperator,
  Metric,
  TreatMissingData,
  Unit
} from "aws-cdk-lib/aws-cloudwatch"
import {ITopic} from "aws-cdk-lib/aws-sns"

type AlarmDefinition = {
  name: string
  namespace: string
  metric: string
  description: string
  dimensions?: {[key: string]: string}
  threshold?: number
  comparisonOperator?: ComparisonOperator
  unit?: Unit
}

/**
 * Configuration for creating a CloudWatch metric alarm construct.
 */
export interface MetricAlarmProps {
  /** Prefix used in the generated CloudWatch alarm name. */
  readonly stackName: string
  /** Enables alarm actions when true, disabling notifications when false. */
  readonly enableAlerts: boolean
  /** CloudWatch metric and threshold settings for the alarm. */
  readonly alarmDefinition: AlarmDefinition
  /** SNS topic that receives alarm, OK, and insufficient data notifications. */
  readonly slackAlertTopic: ITopic
}

/**
 * Creates a single CloudWatch alarm and wires all alarm state changes to an SNS topic.
 */
export class MetricAlarm extends Construct {
  alarms: {[key: string]: Alarm}

  /**
   * @example
   * new MetricAlarm(this, 'ApiErrorAlarm', {
   *   stackName: 'pfp-prod',
   *   enableAlerts: true,
   *   alarmDefinition: {
   *     name: 'Api5xx',
   *     namespace: 'AWS/ApiGateway',
   *     metric: '5XXError',
   *     description: 'API 5XX errors detected',
   *     threshold: 1
   *   },
   *   slackAlertTopic
   * })
   */
  public constructor(scope: Construct, id: string, props: MetricAlarmProps) {
    super(scope, id)

    const metricFunction = (name: string, namespace: string) =>
      new Metric({
        metricName: name,
        namespace,
        dimensionsMap: props.alarmDefinition.dimensions,
        unit: props.alarmDefinition.unit ?? Unit.COUNT,
        statistic: "Sum",
        period: Duration.minutes(1)
      })

    const alarm = new Alarm(this, `${props.alarmDefinition.name}Alarm`, {
      alarmName: `${props.stackName}-${props.alarmDefinition.name}`,
      metric: metricFunction(props.alarmDefinition.metric, props.alarmDefinition.namespace),
      threshold: props.alarmDefinition.threshold ?? 1,
      evaluationPeriods: 1,
      comparisonOperator:
        props.alarmDefinition.comparisonOperator ?? ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: props.alarmDefinition.description,
      actionsEnabled: props.enableAlerts
    })

    alarm.addAlarmAction({
      bind: () => ({alarmActionArn: props.slackAlertTopic.topicArn})
    })
    alarm.addOkAction({
      bind: () => ({alarmActionArn: props.slackAlertTopic.topicArn})
    })
    alarm.addInsufficientDataAction({
      bind: () => ({alarmActionArn: props.slackAlertTopic.topicArn})
    })

    this.alarms = {[props.alarmDefinition.name]: alarm}
  }
}
