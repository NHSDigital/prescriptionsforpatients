import {setNonProductionHeadersForSpine, logger} from "../src/getMyPrescriptions"
import {NHS_LOGIN_HEADER} from "../src/utils"
import type {EventHeaders} from "../src/types"
import {jest} from "@jest/globals"

describe("setNonProductionHeaders", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {...originalEnv}
    jest.spyOn(logger, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it("should not modify headers when ALLOW_NHS_NUMBER_OVERRIDE is not true", () => {
    process.env.ALLOW_NHS_NUMBER_OVERRIDE = "false"
    const headers: EventHeaders = {
      [NHS_LOGIN_HEADER]: "P8:1234567890",
      "x-nhs-number": "9876543210",
      "nhs-login-identity-proofing-level": "P8"
    }

    const result = setNonProductionHeadersForSpine(headers)

    expect(result[NHS_LOGIN_HEADER]).toBe("P8:1234567890")
  })

  it("should not modify headers when NHS_LOGIN_HEADER starts with P9:", () => {
    process.env.ALLOW_NHS_NUMBER_OVERRIDE = "true"
    const headers: EventHeaders = {
      [NHS_LOGIN_HEADER]: "P9:1234567890",
      "x-nhs-number": "9876543210",
      "nhs-login-identity-proofing-level": "P9"
    }

    const result = setNonProductionHeadersForSpine(headers)

    expect(result[NHS_LOGIN_HEADER]).toBe("P9:1234567890")
  })

  it("should not modify headers when x-nhs-number is not present", () => {
    process.env.ALLOW_NHS_NUMBER_OVERRIDE = "true"
    const headers: EventHeaders = {
      [NHS_LOGIN_HEADER]: "P8:1234567890",
      "nhs-login-identity-proofing-level": "P8"
    }

    const result = setNonProductionHeadersForSpine(headers)

    expect(result[NHS_LOGIN_HEADER]).toBe("P8:1234567890")
  })

  it("should override NHS_LOGIN_HEADER when all conditions are met", () => {
    process.env.ALLOW_NHS_NUMBER_OVERRIDE = "true"
    const headers: EventHeaders = {
      [NHS_LOGIN_HEADER]: "P8:1234567890",
      "x-nhs-number": "9876543210",
      "nhs-login-identity-proofing-level": "P8"
    }

    const result = setNonProductionHeadersForSpine(headers)

    expect(result[NHS_LOGIN_HEADER]).toBe("P8:9876543210")
    expect(logger.info).toHaveBeenCalledWith("Set non production headers for Spine call", {headers: result})
  })
})
