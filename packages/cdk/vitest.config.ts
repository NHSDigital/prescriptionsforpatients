import {createVitestConfig} from "../../vitest.default.config"

export default createVitestConfig({
  workspaceRoot: "../../",
  inlineDeps: ["@nhsdigital/eps-cdk-constructs"]
})
