import type {JestConfigWithTsJest} from "ts-jest"

const jestConfig: JestConfigWithTsJest = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testMatch: ["**/tests/*.test.js"]
}

export default jestConfig
