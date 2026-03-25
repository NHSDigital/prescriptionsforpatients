import {execFileSync} from "node:child_process"
import {existsSync, mkdirSync, unlinkSync, writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {describe, expect, it} from "vitest"

const cdkPackageRoot = resolve(__dirname, "..")
const getSecretsLayerZipPath = resolve(cdkPackageRoot, "../getSecretLayer/lib/get-secrets-layer.zip")

function createBaseEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    CI: "true",
    CDK_DEFAULT_REGION: "eu-west-2",
    CDK_CONFIG_versionNumber: "0.0.0-test",
    CDK_CONFIG_commitId: "test-commit",
    CDK_CONFIG_isPullRequest: "true",
    CDK_CONFIG_environment: "test",
    CDK_CONFIG_tc007NhsNumberValue: "9992387920",
    CDK_CONFIG_tc008NhsNumberValue: "9992387920",
    CDK_CONFIG_tc009NhsNumberValue: "9992387920"
  }
}

describe("CDK synth smoke tests", () => {
  it("synthesizes the sandbox app", () => {
    expect(() => {
      execFileSync("npx", ["tsx", "bin/PfPApiSandboxApp.ts"], {
        cwd: cdkPackageRoot,
        stdio: "pipe",
        env: createBaseEnv()
      })
    }).not.toThrow()
  })

  it("synthesizes the main app", () => {
    let shouldDeleteDummyLayer = false

    if (!existsSync(getSecretsLayerZipPath)) {
      mkdirSync(resolve(getSecretsLayerZipPath, ".."), {recursive: true})
      // This file only needs to exist for CDK asset staging in synth tests.
      writeFileSync(getSecretsLayerZipPath, Buffer.from("PK\u0003\u0004"))
      shouldDeleteDummyLayer = true
    }

    expect(() => {
      try {
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
            CDK_CONFIG_forwardCsocLogs: "false"
          }
        })
      } finally {
        if (shouldDeleteDummyLayer) {
          unlinkSync(getSecretsLayerZipPath)
        }
      }
    }).not.toThrow()
  })
})
