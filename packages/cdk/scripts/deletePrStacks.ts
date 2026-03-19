import {deleteUnusedPrStacks} from "@nhsdigital/eps-cdk-constructs"

deleteUnusedPrStacks(
  "pfp-api",
  "prescriptionsforpatients",
  "dev.eps.national.nhs.uk."
).catch((error) => {
  console.error(error)
  process.exit(1)
})
