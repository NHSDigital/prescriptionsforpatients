import {createVitestConfig} from "../../vitest.default.config"

const config = createVitestConfig({
  workspaceRoot: "../../",
  setupFiles: ["tests/setup.ts"]
})

config.test.coverage.exclude = [
  ...(config.test.coverage.exclude || []),
  "src/enrichPrescriptions.ts",
  "src/fhirUtils.ts"
]

export default config
