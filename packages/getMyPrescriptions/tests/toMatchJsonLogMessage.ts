/* eslint-disable func-style */
import {expect} from "@jest/globals"
import type {MatcherFunction} from "expect"
import * as _ from "lodash-es"

/*
This is a custom matcher that extends jest expect
Its used for matching console log messages where the message sent to console is pretty printed JSON
It converts the console log message to JSON, then compares an expected field in the JSON to expected value
It also checks a field in actual value does not exist
*/
const toMatchJsonLogMessage: MatcherFunction<[jsonField: unknown, jsonValue: unknown, missingJsonField: unknown]> =
  function (actual, jsonField, jsonValue, missingJsonField) {
    if (
      typeof actual !== "string" ||
      typeof jsonField !== "string" ||
      typeof jsonValue !== "string" ||
      typeof missingJsonField !== "string"
    ) {
      throw new TypeError("These must be of type string!")
    }
    const actualJson = JSON.parse(actual)
    const pass = _.get(actualJson, jsonField, "") === jsonValue && _.get(actualJson, missingJsonField, "") === ""
    if (pass) {
      return {
        message: () => "",
        pass: true
      }
    } else {
      return {
        message: () => `expected JSON log message ${this.utils.printReceived(
          actualJson,
        )} to have ${this.utils.printExpected(
          `${jsonField} with value ${jsonValue} and ${missingJsonField} to not exist`,
        )}`,
        pass: false
      }
    }
  }

expect.extend({
  toMatchJsonLogMessage
})

declare module "expect" {
  interface AsymmetricMatchers {
    toMatchJsonLogMessage(jsonField: string, jsonValue: string, missingJsonField: string): void;
  }
  interface Matchers<R> {
    toMatchJsonLogMessage(jsonField: string, jsonValue: string, missingJsonField: string): R;
  }
}
