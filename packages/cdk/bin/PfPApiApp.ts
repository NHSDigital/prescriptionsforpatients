import {
  calculateVersionedStackName,
  createApp,
  getBooleanConfigFromEnvVar,
  getConfigFromEnvVar,
  getNumberConfigFromEnvVar
} from "@nhsdigital/eps-cdk-constructs"
import {PfPApiStack} from "../stacks/PfPApiStack"

function main() {
  const {app, props} = createApp({
    productName: "Prescriptions for Patients API",
    appName: "PfPApiApp",
    repoName: "prescriptionsforpatients",
    driftDetectionGroup: "pfp-api"
  })

  const pfpApiStack = new PfPApiStack(app, "PfPApiStack", {
    ...props,
    stackName: calculateVersionedStackName(getConfigFromEnvVar("stackName"), props),
    logRetentionInDays: getNumberConfigFromEnvVar("logRetentionInDays"),
    logLevel: getConfigFromEnvVar("logLevel"),
    targetSpineServer: getConfigFromEnvVar("targetSpineServer"),
    targetServiceSearchServer: getConfigFromEnvVar("targetServiceSearchServer"),
    toggleGetStatusUpdates: getConfigFromEnvVar("toggleGetStatusUpdates"),
    allowNhsNumberOverride: getConfigFromEnvVar("allowNhsNumberOverride"),
    tc007NhsNumberValue: getConfigFromEnvVar("tc007NhsNumberValue", ""),
    tc008NhsNumberValue: getConfigFromEnvVar("tc008NhsNumberValue", ""),
    tc009NhsNumberValue: getConfigFromEnvVar("tc009NhsNumberValue", ""),
    mutualTlsTrustStoreKey: props.isPullRequest ? undefined : getConfigFromEnvVar("trustStoreFile"),
    // CSOC API GW log destination - do not change
    csocApiGatewayDestination: "arn:aws:logs:eu-west-2:693466633220:destination:api_gateway_log_destination",
    forwardCsocLogs: getBooleanConfigFromEnvVar("forwardCsocLogs")
  })

  return pfpApiStack
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
