import {deleteUnusedPrStacks} from "@nhsdigital/eps-cdk-constructs"
import {API_NAME} from "../constants"

deleteUnusedPrStacks(
  API_NAME,
  "prescriptionsforpatients",
  "dev.eps.national.nhs.uk."
).catch((error) => {
  console.error(error)
  process.exit(1)
})
