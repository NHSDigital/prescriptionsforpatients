import type {JestConfigWithTsJest} from "ts-jest"
import defaultConfig from "../../../jest.default.config"

const jestConfig: JestConfigWithTsJest = {
  ...defaultConfig,
  rootDir: "./",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@common/testing$": "<rootDir>/../tests/lib/index.js",
    "^@common/testing/(.*)$": "<rootDir>/../tests/lib/$1.js",
    "^@common/utilities$": "<rootDir>/lib/index.js",
    "^@common/utilities/(.*)$": "<rootDir>/lib/$1.js"
  }
}

export default jestConfig
