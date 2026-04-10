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
  metric: string
  description: string
  dimensions?: {[key: string]: string}
  threshold?: number
  comparisonOperator?: ComparisonOperator
  unit?: Unit
}

export interface MetricAlarmProps {
  readonly stackName: string
  readonly enableAlerts: boolean
  readonly namespace: string
  readonly alarmDefinition: AlarmDefinition
  readonly slackAlertTopic: ITopic
}

export class MetricAlarm extends Construct {
  alarms: {[key: string]: Alarm}

  public constructor(scope: Construct, id: string, props: MetricAlarmProps){
    super(scope, id)

    const metricFunction = (metricName: string) =>
      new Metric({
        namespace: props.namespace,
        metricName,
        dimensionsMap: props.alarmDefinition.dimensions,
        unit: props.alarmDefinition.unit ?? Unit.COUNT,
        statistic: "Sum",
        period: Duration.minutes(1)
      })

    const alarm = new Alarm(this, `${props.alarmDefinition.name}Alarm`, {
      alarmName: `${props.stackName}-${props.alarmDefinition.name}`,
      metric: metricFunction(props.alarmDefinition.metric),
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
