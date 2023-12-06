import sharedConfig from "../../jest.default.config"
import type {JestConfigWithTsJest} from "ts-jest"

const jestConfig: JestConfigWithTsJest = {
  ...sharedConfig,
  "rootDir": "./",
  testMatch: ["<rootDir>/tests/**"]
}

export default jestConfig
