import {deleteProxygenDeployments} from "@nhsdigital/eps-deployment-utils"

deleteProxygenDeployments(
  "clinical-prescription-tracker",
  "electronic-prescription-service-clinical-prescription-tracker",
  "ClinicalTrackerProxygenPrivateKey",
  "eps-clinical-tracker"
).catch((error) => {
  console.error("Error deleting proxygen deployments:", error)
  process.exit(1)
})
