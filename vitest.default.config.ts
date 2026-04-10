import path from "node:path"
import {defineConfig} from "vitest/config"

type VitestDefaultConfigOptions = {
  workspaceRoot: string;
  setupFiles?: Array<string>;
  aliasOverrides?: Record<string, string>;
  inlineDeps?: Array<string>;
}

export function createVitestConfig(options: VitestDefaultConfigOptions) {
  const {workspaceRoot, setupFiles = [], aliasOverrides = {}, inlineDeps = []} = options

  return defineConfig({
    resolve: {
      alias: [
        {find: /^(\\.{1,2}\/.*)\.js$/, replacement: "$1"},
        {
          find: "@pfp-common/testing",
          replacement: path.resolve(workspaceRoot, "packages/common/testing/lib/index.js")
        },
        {
          find: "@pfp-common/utilities",
          replacement: path.resolve(workspaceRoot, "packages/common/utilities/lib/index.js")
        },
        ...Object.entries(aliasOverrides).map(([find, replacement]) => ({
          find,
          replacement: path.resolve(workspaceRoot, replacement)
        }))
      ]
    },
    test: {
      clearMocks: true,
      coverage: {
        exclude: [
          "**/node_modules/**",
          "**/lib/**",
          "**/coverage/**",
          "**/tests/**",
          "**/*.config.ts",
          "**/*.d.ts",
          "**/vitest.default.config.ts"
        ],
        provider: "v8",
        reportsDirectory: "coverage",
        reporter: ["text", "lcov", "json", "clover"]
      },
      environment: "node",
      globals: true,
      include: ["tests/*.test.ts"],
      server: {
        deps: {
          inline: ["@nhsdigital/eps-spine-client", /@middy/, ...inlineDeps]
        }
      },
      setupFiles
    }
  })
}
