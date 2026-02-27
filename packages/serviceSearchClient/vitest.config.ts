import {createVitestConfig} from "../../vitest.default.config"

const config = createVitestConfig({
  workspaceRoot: "../../"
})

config.test.coverage.exclude = [
  ...(config.test.coverage.exclude || []),
  "src/handleUrl.ts",
  "src/live-serviceSearch-client.ts"
]

export default config
