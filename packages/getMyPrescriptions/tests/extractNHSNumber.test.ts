import {
  extractNHSNumber,
  extractNHSNumberFromHeaders,
  NHSNumberValidationError,
  validateNHSNumber
} from "../src/extractNHSNumber"
import "jest"

type failureTestData = {nhsdLoginUser: string | undefined; errorMessage: string; scenarioDescription: string}

describe("failureTestData nhs number", () => {
  it.each<failureTestData>([
    {
      nhsdLoginUser: undefined,
      errorMessage: "nhsdloginUser not passed in",
      scenarioDescription: "no nhsdLoginUser passed in"
    },
    {
      nhsdLoginUser: "9912003072",
      errorMessage: "NHS Number failed preflight checks",
      scenarioDescription: "cant split nhsdLoginUser"
    },
    {
      nhsdLoginUser: "P9:A",
      errorMessage: "NHS Number failed preflight checks",
      scenarioDescription: "nhs number in nhsdLoginUser contains a string"
    },
    {
      nhsdLoginUser: "P9:123",
      errorMessage: "NHS Number failed preflight checks",
      scenarioDescription: "nhs number in nhsdLoginUser is too short"
    },
    {
      nhsdLoginUser: "P0:9912003071",
      errorMessage: "Identity proofing level is not P9",
      scenarioDescription: "Identity proofing in nhsdLoginUser is not P9"
    },
    {
      nhsdLoginUser: "P0:9912003072",
      errorMessage: "Identity proofing level is not P9",
      scenarioDescription: "nhs number does not validate checksum"
    }
  ])("throw error when $scenarioDescription", ({nhsdLoginUser, errorMessage}) => {
    expect(() => {
      extractNHSNumber(nhsdLoginUser)
    }).toThrow(new NHSNumberValidationError(errorMessage))
  })

  test("should return nhs number for valid input", () => {
    const nhsNumber = extractNHSNumber("P9:9912003071")
    expect(nhsNumber).toBe("9912003071")
  })
})

describe("validateNHSNumber function", () => {
  it("should reject 991003072", () => {
    const nhsNumber = "991003072"
    expect(() => {
      validateNHSNumber(nhsNumber)
    }).toThrow(new NHSNumberValidationError(`Invalid check digit in NHS number ${nhsNumber}`))
  })
  it("should reject 991003074", () => {
    const nhsNumber = "991003074"
    expect(() => {
      validateNHSNumber(nhsNumber)
    }).toThrow(new NHSNumberValidationError(`Invalid check digit in NHS number ${nhsNumber}`))
  })
})

describe("extractNHSNumberFromHeaders function", () => {
  it("should extract NHS number using validateNHSNumber when proofing level header is present", () => {
    const headers = {
      "nhs-login-identity-proofing-level": "P9",
      "nhsd-nhslogin-user": "9912003071"
    }
    const result = extractNHSNumberFromHeaders(headers)
    expect(result).toBe("9912003071")
  })

  it("should extract NHS number using extractNHSNumber when proofing level header is absent", () => {
    const headers = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const result = extractNHSNumberFromHeaders(headers)
    expect(result).toBe("9912003071")
  })

  it("should throw error when proofing level header is present but NHS number is invalid", () => {
    const headers = {
      "nhs-login-identity-proofing-level": "P9",
      "nhsd-nhslogin-user": "9912003072"
    }
    expect(() => {
      extractNHSNumberFromHeaders(headers)
    }).toThrow(new NHSNumberValidationError("Invalid check digit in NHS number 9912003072"))
  })

  it("should throw error when proofing level header is absent and nhsd-nhslogin-user is undefined", () => {
    const headers = {}
    expect(() => {
      extractNHSNumberFromHeaders(headers)
    }).toThrow(new NHSNumberValidationError("nhsdloginUser not passed in"))
  })
})
