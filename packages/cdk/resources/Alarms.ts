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
import {MetricAlarm} from "../constructs/MetricAlarm"

export interface AlarmsProps {
  readonly stackName: string
  readonly enableAlerts: boolean
  readonly functions: {[key: string]: TypescriptLambdaFunction}
}

export class Alarms extends Construct {
  private readonly metricAlarms: Array<MetricAlarm> = []

  public constructor(scope: Construct, id: string, props: AlarmsProps) {
    super(scope, id)

    const createMetricFilter = (
      metricFilterId: string,
      metricFilterProps: {
        filterName: string
        filterPattern: IFilterPattern
        logGroup: ILogGroup
        metricNamespace: string
        metricName?: string
        metricValue?: string
        unit?: Unit
        dimensions?: {[key: string]: string}
      }
    ) => new MetricFilter(this, metricFilterId, {
      ...metricFilterProps,
      metricName: metricFilterProps.metricName ?? "ErrorCount",
      metricValue: metricFilterProps.metricValue ?? "1",
      unit: metricFilterProps.unit ?? Unit.COUNT
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
      dimensions: {
        FunctionName: "$.function_name"
      }
    })

    this.metricAlarms.push(new MetricAlarm(this, "ServiceSearchErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      namespace: "LambdaLogFilterMetrics",
      alarmDefinition: {
        name: "ServiceSearch_Errors",
        metric: "ServiceSearchErrorCount",
        description: "Count of Service Search errors",
        dimensions: {
          FunctionName: getMyPrescriptionsFunction.functionName
        }
      },
      slackAlertTopic
    }))

    this.metricAlarms.push(new MetricAlarm(this, "ServiceSearchUnhandledErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      namespace: "Lambda",
      alarmDefinition: {
        name: "ServiceSearch_UnhandledErrors",
        metric: "Errors",
        description: "Count of Service Search unhandled errors",
        dimensions: {
          FunctionName: getMyPrescriptionsFunction.functionName
        }
      },
      slackAlertTopic
    }))

    createMetricFilter("GetMyPrescriptionsErrorsLogsMetricFilter", {
      filterName: `${props.stackName}_GetMyPrescriptionsErrors`,
      filterPattern: FilterPattern.literal(
        `{ ($.level = "ERROR") && ($.function_name = "${getMyPrescriptionsFunction.functionName}") ` +
        "&& ($.message != %error in request to serviceSearch%) }"
      ),
      logGroup: getMyPrescriptionsFunction.logGroup,
      metricNamespace: "LambdaLogFilterMetrics",
      dimensions: {
        FunctionName: "$.function_name"
      }
    })

    this.metricAlarms.push(new MetricAlarm(this, "GetMyPrescriptionsErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      namespace: "LambdaLogFilterMetrics",
      alarmDefinition: {
        name: "GetMyPrescriptions_Errors",
        metric: "ErrorCount",
        description: "Count of GetMyPrescriptions errors",
        dimensions: {
          FunctionName: getMyPrescriptionsFunction.functionName
        }
      },
      slackAlertTopic
    }))

    createMetricFilter("EnrichPrescriptionsErrorsLogsMetricFilter", {
      filterName: `${props.stackName}_EnrichPrescriptionsErrors`,
      filterPattern: FilterPattern.literal("ERROR"),
      logGroup: enrichPrescriptionsFunction.logGroup,
      metricNamespace: "LambdaLogFilterMetrics",
      metricName: `${props.stackName}EnrichPrescriptionsErrorCount`
    })

    this.metricAlarms.push(new MetricAlarm(this, "EnrichPrescriptionsErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      namespace: "LambdaLogFilterMetrics",
      alarmDefinition: {
        name: "EnrichPrescriptions_Errors",
        metric: `${props.stackName}EnrichPrescriptionsErrorCount`,
        description: "Count of EnrichPrescriptions errors"
      },
      slackAlertTopic
    }))
  }
}
