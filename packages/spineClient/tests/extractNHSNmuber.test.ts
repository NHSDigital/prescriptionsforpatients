import {extractNHSNumber, NHSNumberValidationError} from "../src/extractNHSNumber"
import "jest"

type failureTestData = [nhsdLoginUser: string | undefined, errorMessage: string]

describe("failureTestData nhs number", () => {
  test.each<failureTestData>([
    ["P9:A", "NHS Number failed preflight checks"],
    [undefined, "nhsloginUser not passed in"],
    ["P9:123", "NHS Number failed preflight checks"],
    ["P0:9912003071", "Identity proofing level is not P9"],
    ["P9:9912003072", "invalid check digit in NHS number"]
  ])("throw error when nhsd-login-user %j is passed in", (nhsdLoginUser, errorMessage) => {
    expect(() => {
      extractNHSNumber(nhsdLoginUser)
    }).toThrow(new NHSNumberValidationError(errorMessage))
  })

  test("should return nhs number for valid input", () => {
    const nhsNumber = extractNHSNumber("P9:9912003071")
    expect(nhsNumber).toBe("9912003071")
  })
})
