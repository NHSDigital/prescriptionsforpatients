import {
  calculateVersionedStackName,
  CDK_ENV_PREFIX,
  createApp,
  getConfigFromEnvVar,
  getNumberConfigFromEnvVar
} from "@nhsdigital/eps-cdk-constructs"
import {PfPApiSandboxStack} from "../stacks/PfPApiSandboxStack"

function main() {
  const {app, props} = createApp({
    productName: "Prescriptions for Patients API",
    appName: "PfPApiSandboxApp",
    repoName: "prescriptionsforpatients",
    driftDetectionGroup: "pfp-api"
  })

  new PfPApiSandboxStack(app, "PfPApiSandboxStack", {
    ...props,
    stackName: calculateVersionedStackName(getConfigFromEnvVar("stackName", CDK_ENV_PREFIX, "pfp-sandbox"), props),
    targetSpineServer: getConfigFromEnvVar("targetSpineServer", CDK_ENV_PREFIX, "none"),
    targetServiceSearchServer: getConfigFromEnvVar("targetServiceSearchServer", CDK_ENV_PREFIX, "none"),
    logRetentionInDays: getNumberConfigFromEnvVar("logRetentionInDays", CDK_ENV_PREFIX, "30"),
    logLevel: getConfigFromEnvVar("logLevel", CDK_ENV_PREFIX, "INFO"),
    mutualTlsTrustStoreKey: props.isPullRequest ?
      undefined : getConfigFromEnvVar("trustStoreFile", CDK_ENV_PREFIX, "none")
  })
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
