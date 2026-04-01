import {execFileSync} from "node:child_process"
import {resolve} from "node:path"
import {describe, expect, it} from "vitest"

const cdkPackageRoot = resolve(__dirname, "..")

function createBaseEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "true",
    CDK_DEFAULT_REGION: "eu-west-2",
    CDK_CONFIG_versionNumber: "0.0.0-test",
    CDK_CONFIG_commitId: "test-commit",
    CDK_CONFIG_isPullRequest: "true",
    CDK_CONFIG_environment: "test"
  }
}

describe("CDK synth smoke tests", () => {
  it("type-checks the cdk package", () => {
    expect(() => {
      execFileSync("npx", ["tsc", "-p", "tsconfig.json", "--noEmit"], {
        cwd: cdkPackageRoot,
        stdio: "pipe"
      })
    }).not.toThrow()
  })

  it("synthesizes the sandbox app", () => {
    expect(() => {
      execFileSync("npx", ["tsx", "bin/PfPApiSandboxApp.ts"], {
        cwd: cdkPackageRoot,
        stdio: "pipe",
        env: createBaseEnv()
      })
    }).not.toThrow()
  }, 30000)

  it("synthesizes the main app", () => {
    expect(() => {
      execFileSync("npx", ["tsx", "bin/PfPApiApp.ts"], {
        cwd: cdkPackageRoot,
        stdio: "pipe",
        env: {
          ...createBaseEnv(),
          CDK_CONFIG_stackName: "pfp-test-stack",
          CDK_CONFIG_logRetentionInDays: "7",
          CDK_CONFIG_logLevel: "INFO",
          CDK_CONFIG_targetSpineServer: "https://example-spine.test",
          CDK_CONFIG_targetServiceSearchServer: "https://live/service-search-api/",
          CDK_CONFIG_toggleGetStatusUpdates: "true",
          CDK_CONFIG_allowNhsNumberOverride: "false",
          CDK_CONFIG_tc007NhsNumberValue: "9000000009",
          CDK_CONFIG_tc008NhsNumberValue: "9000000017",
          CDK_CONFIG_tc009NhsNumberValue: "9000000025",
          CDK_CONFIG_forwardCsocLogs: "false"
        }
      })
    }).not.toThrow()
  }, 30000)
})
