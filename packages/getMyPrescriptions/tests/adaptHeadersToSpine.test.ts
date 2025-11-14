import {Logger} from "@aws-lambda-powertools/logger"
import {adaptHeadersToSpine, DEFAULT_HANDLER_PARAMS} from "../src/getMyPrescriptions"
import {NHSNumberValidationError} from "../src/extractNHSNumber"
import {setupTestEnvironment} from "@pfp-common/testing"
import {
  expect,
  describe,
  it,
  jest,
  beforeEach,
  afterEach
} from "@jest/globals"

type EventHeaders = Record<string, string | undefined>

describe("adaptHeadersToSpine", () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
  })

  afterEach(() => {
    testEnv.restoreEnvironment()
    jest.clearAllMocks()
  })

  describe("non-delegated access", () => {
    it("should process non-delegated access when nhsd-delegated-access is undefined", () => {
      const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071",
        "other-header": "value"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9912003071")
      expect(mockLoggerInfo).toHaveBeenCalledWith("Non-delegated access request detected")
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "actor: P9:9912003071, subject: 9912003071",
        {headers: result}
      )
    })

    it("should process non-delegated access when nhsd-delegated-access is false", () => {
      const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
      const headers: EventHeaders = {
        "nhsd-delegated-access": "false",
        "nhsd-nhslogin-user": "P9:9912003071"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9912003071")
      expect(mockLoggerInfo).toHaveBeenCalledWith("Non-delegated access request detected")
    })

    it("should preserve other headers in non-delegated access", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071",
        "x-request-id": "test-request-id",
        "nhsd-correlation-id": "test-correlation-id"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result["x-request-id"]).toBe("test-request-id")
      expect(result["nhsd-correlation-id"]).toBe("test-correlation-id")
      expect(result.nhsNumber).toBe("9912003071")
    })
  })

  describe("delegated access", () => {
    it("should process delegated access when nhsd-delegated-access is true", () => {
      const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
      const headers: EventHeaders = {
        "nhsd-delegated-access": "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        "x-nhsd-subject-nhs-number": "9912003071",
        "x-nhsd-actor-nhs-number": "9999681778"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9999681778")
      expect(mockLoggerInfo).toHaveBeenCalledWith("Delegated access request detected")
      expect(mockLoggerInfo).toHaveBeenNthCalledWith(2,
        "actor: P9:9999681778, subject: 9912003071",
        {headers: result}
      )
    })

    it("should throw NHSNumberValidationError for invalid x-nhsd-subject-nhs-number in delegated access", () => {
      const headers: EventHeaders = {
        "nhsd-delegated-access": "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        "x-nhsd-subject-nhs-number": "invalid-subject",
        "x-nhsd-actor-nhs-number": "9912003072"
      }

      expect(() => adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers))
        .toThrow(NHSNumberValidationError)
    })

    it("should throw NHSNumberValidationError for invalid x-nhsd-actor-nhs-number in delegated access", () => {
      const headers: EventHeaders = {
        "nhsd-delegated-access": "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        "x-nhsd-subject-nhs-number": "9912003071",
        "x-nhsd-actor-nhs-number": "invalid-actor"
      }

      expect(() => adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers))
        .toThrow(NHSNumberValidationError)
    })

    it("should throw NHSNumberValidationError when actor NHS number does not match logged in user", () => {
      const headers: EventHeaders = {
        "nhsd-delegated-access": "true",
        "nhsd-nhslogin-user": "P9:9912003071", // Logged in user
        "x-nhsd-subject-nhs-number": "9999681778",
        "x-nhsd-actor-nhs-number": "9999681778" // Different from logged in user
      }

      expect(() => adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers))
        .toThrow(NHSNumberValidationError)
      expect(() => adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers))
        .toThrow("Actor NHS number 9999681778 does not match NHS number of logged in user 9912003071")
    })

    it("should preserve other headers in delegated access", () => {
      const headers: EventHeaders = {
        "nhsd-delegated-access": "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        "x-nhsd-subject-nhs-number": "9912003071",
        "x-nhsd-actor-nhs-number": "9999681778",
        "x-request-id": "test-request-id",
        "nhsd-correlation-id": "test-correlation-id"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result["x-request-id"]).toBe("test-request-id")
      expect(result["nhsd-correlation-id"]).toBe("test-correlation-id")
      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9999681778")
    })
  })

  describe("return value and mutations", () => {
    it("should return the same headers object (mutated)", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071",
        "original-header": "value"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(result).toBe(headers) // Same object reference
      expect(result.nhsNumber).toBe("9912003071")
      expect(result["original-header"]).toBe("value")
    })

    it("should mutate the original headers object", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071"
      }

      adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      expect(headers.nhsNumber).toBe("9912003071")
    })
  })

  describe("edge cases", () => {
    it("should handle case sensitivity for delegated access flag", () => {
      const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
      const headers: EventHeaders = {
        "nhsd-delegated-access": "TRUE", // Different case
        "nhsd-nhslogin-user": "P9:9912003071"
      }

      const result = adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers)

      // Should be treated as non-delegated since it's not exactly "true"
      expect(result.nhsNumber).toBe("9912003071")
      expect(mockLoggerInfo).toHaveBeenCalledWith("Non-delegated access request detected")
    })

    it("should handle missing headers gracefully by throwing appropriate errors", () => {
      const headers: EventHeaders = {}

      expect(() => adaptHeadersToSpine(DEFAULT_HANDLER_PARAMS, headers))
        .toThrow(NHSNumberValidationError)
    })
  })
})
