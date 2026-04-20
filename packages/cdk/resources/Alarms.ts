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
  private readonly snsAlarms: Array<SnsAlarm>

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

    const serviceSearchErrorsAlarm = new SnsAlarm(this, "ServiceSearchErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      alarmDefinition: {
        alarmDescription: "Count of Service Search errors"
      },
      metricStatConfig: {
        namespace: "LambdaLogFilterMetrics",
        metricName: "ServiceSearchErrorCount",
        dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
      },
      slackAlertTopic
    })

    const serviceSearchUnhandledErrorsAlarm = new SnsAlarm(this, "ServiceSearchUnhandledErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      alarmDefinition: {
        alarmDescription: "Count of Service Search unhandled errors"
      },
      metricStatConfig: {
        namespace: "Lambda",
        metricName: "ServiceSearchUnhandledErrors",
        dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
      },
      slackAlertTopic
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

    const getMyPrescriptionsErrorsAlarm = new SnsAlarm(this, "GetMyPrescriptionsErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      alarmDefinition: {
        alarmDescription: "Count of GetMyPrescriptions errors"
      },
      metricStatConfig: {
        namespace: "LambdaLogFilterMetrics",
        metricName: "ErrorCount",
        dimensions: [{name: "FunctionName", value: getMyPrescriptionsFunction.functionName}]
      },
      slackAlertTopic
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

    const enrichPrescriptionsErrorsAlarm = new SnsAlarm(this, "EnrichPrescriptionsErrors", {
      stackName: props.stackName,
      enableAlerts: props.enableAlerts,
      alarmDefinition: {
        alarmDescription: "Count of EnrichPrescriptions errors"
      },
      metricStatConfig: {
        namespace: "LambdaLogFilterMetrics",
        metricName: `${props.stackName}EnrichPrescriptionsErrorCount`
      },
      slackAlertTopic
    })

    this.snsAlarms = [
      serviceSearchErrorsAlarm,
      serviceSearchUnhandledErrorsAlarm,
      getMyPrescriptionsErrorsAlarm,
      enrichPrescriptionsErrorsAlarm
    ]
  }
}
