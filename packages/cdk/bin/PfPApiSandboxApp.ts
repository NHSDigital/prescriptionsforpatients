import {createApp} from "@nhsdigital/eps-cdk-constructs"
import {PfPApiSandboxStack} from "../stacks/PfPApiSandboxStack"

const {app, props} = createApp({
  productName: "Prescriptions for Patients API",
  appName: "PfPApiSandboxApp",
  repoName: "prescriptionsforpatients",
  driftDetectionGroup: "pfp-api"
})

new PfPApiSandboxStack(app, "PfPApiSandboxStack", props)
