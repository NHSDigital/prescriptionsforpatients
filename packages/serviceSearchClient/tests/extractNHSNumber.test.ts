import {extractNHSNumber, NHSNumberValidationError} from "../src/extractNHSNumber"
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
