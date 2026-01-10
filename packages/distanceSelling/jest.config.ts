import type {JestConfigWithTsJest} from "ts-jest"
import defaultConfig from "../../jest.default.config.ts"

const jestConfig: JestConfigWithTsJest = {
  ...defaultConfig,
  "rootDir": "./"
}

export default jestConfig
