import sharedConfig from "../../jest.default.config"
module.exports = {
  ...sharedConfig,
  "rootDir": "./",
  testMatch: ["<rootDir>/tests/**"],

}
