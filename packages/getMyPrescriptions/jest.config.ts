import type {JestConfigWithTsJest} from "ts-jest"
import sharedConfig from "../../jest.default.config"

const jestConfig: JestConfigWithTsJest = {
  ...sharedConfig,
  "rootDir": "./"
}

export default jestConfig
