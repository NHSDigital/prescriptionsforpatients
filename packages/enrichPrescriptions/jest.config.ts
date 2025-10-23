import type {JestConfigWithTsJest} from "ts-jest"
import defaultConfig from "../../jest.default.config"

const jestConfig: JestConfigWithTsJest = {
  ...defaultConfig,
  "rootDir": "./",
  "setupFilesAfterEnv": ["<rootDir>/tests/setup.ts"]
}

export default jestConfig
