import config from "./jest.config.ts"
import type {JestConfigWithTsJest} from "ts-jest"

const debugConfig: JestConfigWithTsJest = {
  ...config,
  "preset": "ts-jest"
}

export default debugConfig
