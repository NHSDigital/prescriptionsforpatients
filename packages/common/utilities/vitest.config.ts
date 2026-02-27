import {createVitestConfig} from "../../../vitest.default.config"

export default createVitestConfig({
  workspaceRoot: "../../../",
  aliasOverrides: {
    "@pfp-common/utilities": "packages/common/utilities/src/index.ts",
    "@pfp-common/utilities/config": "packages/common/utilities/src/config.ts"
  }
})
