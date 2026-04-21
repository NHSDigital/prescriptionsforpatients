import {Fn} from "aws-cdk-lib"
import {Unit} from "aws-cdk-lib/aws-cloudwatch"
import {
  MetricFilter,
  FilterPattern,
  IFilterPattern,
  ILogGroup
} from "aws-cdk-lib/aws-logs"
import {Topic} from "aws-cdk-lib/aws-sns"
import {TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Construct} from "constructs"
import {SnsAlarm} from "../constructs/SnsAlarm"

export interface AlarmsProps {
  readonly stackName: string
  readonly enableAlerts: boolean
  readonly functions: {[key: string]: TypescriptLambdaFunction}
}

export class Alarms extends Construct {

  public constructor(scope: Construct, id: string, props: AlarmsProps) {
    super(scope, id)

    const createMetricFilter = (
      metricFilterId: string,
      metricFilterProps: {
        filterName: string
        filterPattern: IFilterPattern
        logGroup: ILogGroup
        metricNamespace: string
        metricName: string
        metricValue: string
        unit?: Unit
        dimensions?: {[key: string]: string}
      }
    ) => new MetricFilter(this, metricFilterId, {
      ...metricFilterProps
    })

    const createSnsAlarm = (
      alarmId: string,
      alarmDescription: string,
      metricStatConfig: {
        namespace: string
        metricName: string
        dimensions?: Array<{name: string, value: string}>
      }
    ) => new SnsAlarm(this, alarmId, {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      alarmDefinition: {
        alarmDescription
      },
      metricStatConfig,
      slackAlertTopic
    })

    const slackAlertTopic = Topic.fromTopicArn(
      this,
      "SlackAlertsTopic",
      Fn.importValue("lambda-resources:SlackAlertsSnsTopicArn")
    )

    const getMyPrescriptionsFunction = props.functions.getMyPrescriptions.function
    const enrichPrescriptionsFunction = props.functions.enrichPrescriptions.function

    createMetricFilter("ServiceSearchErrorsLogsMetricFilter", {
      filterName: "ServiceSearchErrors",
      filterPattern: FilterPattern.literal(
        `{ ($.level = "ERROR") && ($.function_name = "${getMyPrescriptionsFunction.functionName}") ` +
        "&& $.message = %error in request to serviceSearch% }"
      ),
      logGroup: getMyPrescriptionsFunction.logGroup,
      metricNamespace: "LambdaLogFilterMetrics",
      metricName: "ServiceSearchErrorCount",
      metricValue: "1",
      unit: Unit.COUNT,
      dimensions: {
        FunctionName: "$.function_name"
      }
    })

    createSnsAlarm("ServiceSearchErrors", "Count of Service Search errors", {
      namespace: "LambdaLogFilterMetrics",
      metricName: "ServiceSearchErrorCount",
      dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
    })

    createSnsAlarm("ServiceSearchUnhandledErrors", "Count of Service Search unhandled errors", {
      namespace: "Lambda",
      metricName: "ServiceSearchUnhandledErrors",
      dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
    })

    createMetricFilter("GetMyPrescriptionsErrorsLogsMetricFilter", {
      filterName: `${props.stackName}_GetMyPrescriptionsErrors`,
      filterPattern: FilterPattern.literal(
        `{ ($.level = "ERROR") && ($.function_name = "${getMyPrescriptionsFunction.functionName}") ` +
        "&& ($.message != %error in request to serviceSearch%) }"
      ),
      logGroup: getMyPrescriptionsFunction.logGroup,
      metricNamespace: "LambdaLogFilterMetrics",
      metricName: "GetMyPrescriptionsErrorCount",
      metricValue: "1",
      unit: Unit.COUNT,
      dimensions: {
        FunctionName: "$.function_name"
      }
    })

    createSnsAlarm("GetMyPrescriptionsErrors", "Count of GetMyPrescriptions errors", {
      namespace: "LambdaLogFilterMetrics",
      metricName: "ErrorCount",
      dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
    })

    createMetricFilter("EnrichPrescriptionsErrorsLogsMetricFilter", {
      filterName: `${props.stackName}_EnrichPrescriptionsErrors`,
      filterPattern: FilterPattern.literal("ERROR"),
      logGroup: enrichPrescriptionsFunction.logGroup,
      metricNamespace: "LambdaLogFilterMetrics",
      metricName: `${props.stackName}EnrichPrescriptionsErrorCount`,
      metricValue: "1",
      unit: Unit.COUNT
    })

    createSnsAlarm("EnrichPrescriptionsErrors", "Count of EnrichPrescriptions errors", {
      namespace: "LambdaLogFilterMetrics",
      metricName: `${props.stackName}EnrichPrescriptionsErrorCount`
    })

  }
}
