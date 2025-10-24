import type {JestConfigWithTsJest} from "ts-jest"
import defaultConfig from "../../../jest.default.config"

const jestConfig: JestConfigWithTsJest = {
  ...defaultConfig,
  rootDir: "./",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@pfp-common/testing$": "<rootDir>/../testing/lib/index.js",
    "^@pfp-common/testing/(.*)$": "<rootDir>/../testing/lib/$1.js",
    "^@pfp-common/utilities$": "<rootDir>/lib/index.js",
    "^@pfp-common/utilities/(.*)$": "<rootDir>/lib/$1.js"
  }
}

export default jestConfig
