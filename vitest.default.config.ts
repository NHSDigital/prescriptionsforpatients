import path from "node:path"
import {defineConfig} from "vitest/config"

type VitestDefaultConfigOptions = {
  workspaceRoot: string;
  setupFiles?: string[];
  aliasOverrides?: Record<string, string>;
}

export function createVitestConfig(options: VitestDefaultConfigOptions) {
  const {workspaceRoot, setupFiles = [], aliasOverrides = {}} = options

  return defineConfig({
    resolve: {
      alias: [
        {find: /^(\\.{1,2}\/.*)\.js$/, replacement: "$1"},
        {
          find: "@jest/globals",
          replacement: path.resolve(workspaceRoot, "vitest.jest-globals-shim.ts")
        },
        {
          find: "jest",
          replacement: path.resolve(workspaceRoot, "vitest.jest-side-effect-shim.ts")
        },
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
        all: false,
        exclude: [
          "**/node_modules/**",
          "**/lib/**",
          "**/coverage/**",
          "**/tests/**",
          "**/*.config.ts",
          "**/*.d.ts",
          "**/vitest.default.config.ts",
          "**/vitest.jest-globals-shim.ts",
          "**/vitest.jest-side-effect-shim.ts"
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
          inline: ["@nhsdigital/eps-spine-client", /@middy/]
        }
      },
      setupFiles
    }
  })
}
