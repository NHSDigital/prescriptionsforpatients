import {Duration} from "aws-cdk-lib"
import {Construct} from "constructs"
import {
  Alarm,
  ComparisonOperator,
  CreateAlarmOptions,
  Metric,
  MetricStatConfig,
  TreatMissingData,
  Unit
} from "aws-cdk-lib/aws-cloudwatch"
import {SnsAction} from "aws-cdk-lib/aws-cloudwatch-actions"
import {ITopic} from "aws-cdk-lib/aws-sns"

/**
 * Alarm definition for SnsAlarm with defaults applied by the construct.
 */
export interface SnsAlarmDefinition
  extends Omit<CreateAlarmOptions, "threshold" | "evaluationPeriods"> {
  /**
   * The value against which the specified statistic is compared.
   *
   * @default 1
   */
  readonly threshold?: number

  /**
   * The number of periods over which data is compared to the specified threshold.
   *
   * @default 1
   */
  readonly evaluationPeriods?: number
}

/**
 * Metric stat configuration for SnsAlarm with defaults applied by the construct.
 */
export interface SnsMetricStatConfig extends Omit<MetricStatConfig, "period" | "statistic"> {
  /**
   * How many seconds to aggregate over.
   *
   * @default Duration.minutes(1)
   */
  readonly period?: Duration

  /**
   * Aggregation function to use.
   *
   * @default "Sum"
   */
  readonly statistic?: string
}

const toDimensionsMap = (
  dimensions: MetricStatConfig["dimensions"]
): {[dimensionName: string]: string} | undefined => {
  if (!dimensions || dimensions.length === 0) {
    return undefined
  }

  const dimensionMap: {[dimensionName: string]: string} = {}
  dimensions.forEach((dimension) => {
    dimensionMap[dimension.name] = String(dimension.value)
  })
  return dimensionMap
}

/**
 * Constructs a concrete CloudWatch Metric from a MetricStatConfig.
 * @see {@link import("aws-cdk-lib/aws-cloudwatch").MetricConfig} for alternate concrete metric configs.
 */
export const metricFromStatConfig = (
  metricStatConfig: MetricStatConfig
): Metric =>
  new Metric({
    namespace: metricStatConfig.namespace,
    metricName: metricStatConfig.metricName,
    dimensionsMap: toDimensionsMap(metricStatConfig.dimensions),
    statistic: metricStatConfig.statistic,
    period: metricStatConfig.period,
    unit: metricStatConfig.unitFilter,
    account: metricStatConfig.accountOverride ?? metricStatConfig.account,
    region: metricStatConfig.regionOverride ?? metricStatConfig.region
  })

/**
 * Configuration for creating a CloudWatch metric alarm with SNS publication construct.
 */
export interface SnsAlarmProps {

  /** Prefix used in the generated CloudWatch alarm name. */
  readonly stackName: string
  /** Enables alarm actions when true, disabling notifications when false. */
  readonly enableAlerts: boolean
  /** CloudWatch metric and threshold settings for the alarm. */
  readonly alarmDefinition: SnsAlarmDefinition
  /** Defines the metric configuration to be monitored by the alarm. */
  readonly metricStatConfig: SnsMetricStatConfig
  /** SNS topic that receives alarm, OK, and insufficient data notifications. */
  readonly slackAlertTopic: ITopic
}

/**
 * Creates a single CloudWatch alarm and wires all alarm state changes to an SNS topic.
 */
export class SnsAlarm extends Construct {
  alarm: Alarm

  /**
   * Creates a CloudWatch alarm and publishes alarm state changes to the provided SNS topic.
   *
   * @param props Alarm configuration including metric settings, threshold settings, and notification topic.
   * @example
   * new SnsAlarm(this, 'MyApiErrorAlarm', {
   *   stackName: 'pfp-prod',
   *   enableAlerts: true,
   *   alarmDefinition: {
   *     alarmDescription: 'API errors detected',
   *     threshold: 1
   *   },
   *   metricStatConfig: {
   *     namespace: 'LambdaLogFilterMetrics',
   *     metricName: 'ErrorCount'
   *   },
   *   slackAlertTopic
   * })
   */
  public constructor(scope: Construct, id: string, props: SnsAlarmProps) {
    super(scope, id)

    const generatedAlarmName = props.alarmDefinition.alarmName ?? id

    const alarm = new Alarm(this, `${generatedAlarmName}Alarm`, {
      alarmName: `${props.stackName}-${generatedAlarmName}`,
      metric: metricFromStatConfig({
        ...props.metricStatConfig,
        unitFilter: props.metricStatConfig.unitFilter ?? Unit.COUNT,
        statistic: props.metricStatConfig.statistic ?? "Sum",
        period: props.metricStatConfig.period ?? Duration.minutes(1)
      }),
      threshold: props.alarmDefinition.threshold ?? 1,
      evaluationPeriods: props.alarmDefinition.evaluationPeriods ?? 1,
      comparisonOperator:
        props.alarmDefinition.comparisonOperator ?? ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: props.alarmDefinition.treatMissingData ?? TreatMissingData.NOT_BREACHING,
      alarmDescription: props.alarmDefinition.alarmDescription,
      actionsEnabled: props.enableAlerts
    })

    const snsAction = new SnsAction(props.slackAlertTopic)
    alarm.addAlarmAction(snsAction)
    alarm.addOkAction(snsAction)
    alarm.addInsufficientDataAction(snsAction)

    this.alarm = alarm
  }
}
