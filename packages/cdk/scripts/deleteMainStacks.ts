import {deleteUnusedMainStacks, getActiveApiVersions, getConfigFromEnvVar} from "@nhsdigital/eps-cdk-constructs"
import {API_NAME} from "../constants"

const awsEnvironment = getConfigFromEnvVar("AWS_ENVIRONMENT", "")
deleteUnusedMainStacks(
  API_NAME,
  () => getActiveApiVersions("prescriptions-for-patients-v2"),
  `${awsEnvironment}.eps.national.nhs.uk.`
).catch((error) => {
  console.error(error)
  process.exit(1)
})
