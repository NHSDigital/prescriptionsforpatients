import {Logger} from "@aws-lambda-powertools/logger"
import {adaptHeadersToSpine, DELEGATED_ACCESS_HDR, DELEGATED_ACCESS_SUB_HDR} from "../src/getMyPrescriptions"
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

      const result = adaptHeadersToSpine(headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9912003071")
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "after setting subject nhsNumber",
        {headers: result}
      )
    })

    it("should process subject access when delegated access is false", () => {
      const headers: EventHeaders = {
        [DELEGATED_ACCESS_HDR]: "false",
        "nhsd-nhslogin-user": "P9:9912003071"
      }

      const result = adaptHeadersToSpine(headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9912003071")
    })

    it("should preserve other headers in subject access", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071",
        "x-request-id": "test-request-id",
        "nhsd-correlation-id": "test-correlation-id"
      }

      const result = adaptHeadersToSpine(headers)

      expect(result["x-request-id"]).toBe("test-request-id")
      expect(result["nhsd-correlation-id"]).toBe("test-correlation-id")
      expect(result.nhsNumber).toBe("9912003071")
    })
  })

  describe("delegated access", () => {
    it("should process delegated access when nhsd-delegated-access is true", () => {
      const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
      const headers: EventHeaders = {
        [DELEGATED_ACCESS_HDR]: "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        [DELEGATED_ACCESS_SUB_HDR]: "9912003071",
        "other-header": "value"
      }

      const result = adaptHeadersToSpine(headers)

      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9999681778")
      expect(mockLoggerInfo).toHaveBeenNthCalledWith(2,
        "after setting subject nhsNumber",
        {headers: result}
      )
    })

    it("should preserve other headers in delegated access", () => {
      const headers: EventHeaders = {
        [DELEGATED_ACCESS_HDR]: "true",
        "nhsd-nhslogin-user": "P9:9999681778",
        [DELEGATED_ACCESS_SUB_HDR]: "9912003071",
        "x-request-id": "test-request-id",
        "nhsd-correlation-id": "test-correlation-id"
      }

      const result = adaptHeadersToSpine(headers)

      expect(result["x-request-id"]).toBe("test-request-id")
      expect(result["nhsd-correlation-id"]).toBe("test-correlation-id")
      expect(result.nhsNumber).toBe("9912003071")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9999681778")
    })

    it("should perform non-delegated request when subject header is missing for delegated access", () => {
      const headers: EventHeaders = {
        [DELEGATED_ACCESS_HDR]: "true",
        "nhsd-nhslogin-user": "P9:9999681778"
        // Missing DELEGATED_ACCESS_SUB_HDR
      }

      const result = adaptHeadersToSpine(headers)

      expect(result.nhsNumber).toBe("9999681778")
      expect(result["nhsd-nhslogin-user"]).toBe("P9:9999681778")
    })
  })

  describe("return value and mutations", () => {
    it("should return the same headers object (mutated)", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9999681778",
        "original-header": "value"
      }

      const result = adaptHeadersToSpine(headers)

      expect(result).toBe(headers) // Same object reference
      expect(result.nhsNumber).toBe("9999681778")
      expect(result["original-header"]).toBe("value")
    })

    it("should mutate the original headers object", () => {
      const headers: EventHeaders = {
        "nhsd-nhslogin-user": "P9:9999681778"
      }

      adaptHeadersToSpine(headers)

      expect(headers.nhsNumber).toBe("9999681778")
    })
  })

  describe("edge cases", () => {
    it("should be case insensitive for delegated access flag", () => {
      const headers: EventHeaders = {
        [DELEGATED_ACCESS_HDR]: "TrUe", // permit any case
        "nhsd-nhslogin-user": "P9:9999681778",
        [DELEGATED_ACCESS_SUB_HDR]: "2219685934"
      }

      const result = adaptHeadersToSpine(headers)

      // Should be treated as delegated
      expect(result.nhsNumber).toBe("2219685934")
    })

    it("should handle missing headers gracefully by throwing appropriate errors", () => {
      const headers: EventHeaders = {}

      expect(() => adaptHeadersToSpine(headers))
        .toThrow(NHSNumberValidationError)
    })
  })
})
