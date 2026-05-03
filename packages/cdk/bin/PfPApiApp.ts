import {
  CDK_ENV_PREFIX,
  calculateVersionedStackName,
  createApp,
  getBooleanConfigFromEnvVar,
  getConfigFromEnvVar,
  getNumberConfigFromEnvVar
} from "@nhsdigital/eps-cdk-constructs"
import {API_NAME} from "../constants"
import {PfPApiStack} from "../stacks/PfPApiStack"

function main() {
  const {app, props} = createApp({
    productName: "Prescriptions for Patients API",
    appName: "PfPApiApp",
    repoName: "prescriptionsforpatients",
    driftDetectionGroup: API_NAME
  })

  const pfpApiStack = new PfPApiStack(app, "PfPApiStack", {
    ...props,
    stackName: calculateVersionedStackName(getConfigFromEnvVar("stackName"), props),
    logRetentionInDays: getNumberConfigFromEnvVar("logRetentionInDays"),
    logLevel: getConfigFromEnvVar("logLevel"),
    // currently part of the PfP SAM stack but planned to move to new account resources CDK once available
    serviceSearchApiKeySecretName: "pfp-PfP-ServiceSearch-API-Key",
    targetSpineServer: getConfigFromEnvVar("targetSpineServer"),
    targetServiceSearchServer: getConfigFromEnvVar("targetServiceSearchServer"),
    toggleGetStatusUpdates: getConfigFromEnvVar("toggleGetStatusUpdates"),
    allowNhsNumberOverride: getConfigFromEnvVar("allowNhsNumberOverride"),
    tc007NhsNumberValue: getConfigFromEnvVar("tc007NhsNumberValue", CDK_ENV_PREFIX, "992387920"),
    tc008NhsNumberValue: getConfigFromEnvVar("tc008NhsNumberValue", CDK_ENV_PREFIX, "992387920"),
    tc009NhsNumberValue: getConfigFromEnvVar("tc009NhsNumberValue", CDK_ENV_PREFIX, "992387920"),
    enableAlerts: getBooleanConfigFromEnvVar("enableAlerts", CDK_ENV_PREFIX, "true"),
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
