import {
  calculateVersionedStackName,
  createApp,
  getBooleanConfigFromEnvVar,
  getConfigFromEnvVar,
  getNumberConfigFromEnvVar
} from "@nhsdigital/eps-cdk-constructs"
import {buildParametersReadPolicyExportName, PfPApiStatefulStack} from "../stacks/PfPApiStatefulStack"
import {PfPApiStatelessStack} from "../stacks/PfPApiStatelessStack"

const defaultTestNhsNumber = "9992387920"

function main() {
  const {app, props} = createApp({
    productName: "Prescriptions for Patients API",
    appName: "PfPApiApp",
    repoName: "prescriptionsforpatients",
    driftDetectionGroup: "pfp-api"
  })

  const stackName = calculateVersionedStackName(getConfigFromEnvVar("stackName"), props)

  const statefulStack = new PfPApiStatefulStack(app, "PfPApiStatefulStack", {
    ...props,
    stackName,
    tc007NhsNumberValue: getConfigFromEnvVar("tc007NhsNumberValue", "CDK_CONFIG_", defaultTestNhsNumber),
    tc008NhsNumberValue: getConfigFromEnvVar("tc008NhsNumberValue", "CDK_CONFIG_", defaultTestNhsNumber),
    tc009NhsNumberValue: getConfigFromEnvVar("tc009NhsNumberValue", "CDK_CONFIG_", defaultTestNhsNumber)
  })

  const statelessStack = new PfPApiStatelessStack(app, "PfPApiStatelessStack", {
    ...props,
    stackName,
    logRetentionInDays: getNumberConfigFromEnvVar("logRetentionInDays"),
    logLevel: getConfigFromEnvVar("logLevel"),
    targetSpineServer: getConfigFromEnvVar("targetSpineServer"),
    targetServiceSearchServer: getConfigFromEnvVar("targetServiceSearchServer"),
    toggleGetStatusUpdates: getConfigFromEnvVar("toggleGetStatusUpdates"),
    allowNhsNumberOverride: getConfigFromEnvVar("allowNhsNumberOverride"),
    mutualTlsTrustStoreKey: props.isPullRequest ? undefined : getConfigFromEnvVar("trustStoreFile"),
    // CSOC API GW log destination - do not change
    csocApiGatewayDestination: "arn:aws:logs:eu-west-2:693466633220:destination:api_gateway_log_destination",
    forwardCsocLogs: getBooleanConfigFromEnvVar("forwardCsocLogs"),
    parametersReadPolicyExportName: buildParametersReadPolicyExportName(stackName)
  })

  statelessStack.addDependency(statefulStack)

  return statelessStack
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
