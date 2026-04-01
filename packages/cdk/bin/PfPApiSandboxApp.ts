import {
  calculateVersionedStackName,
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
    stackName: calculateVersionedStackName(getConfigFromEnvVar("stackName", "pfp-sandbox"), props),
    targetSpineServer: getConfigFromEnvVar("targetSpineServer", "none"),
    targetServiceSearchServer: getConfigFromEnvVar("targetServiceSearchServer", "none"),
    logRetentionInDays: getNumberConfigFromEnvVar("logRetentionInDays", "30"),
    logLevel: getConfigFromEnvVar("logLevel", "INFO"),
    mutualTlsTrustStoreKey: props.isPullRequest ? undefined : getConfigFromEnvVar("trustStoreFile", "none")
  })
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
