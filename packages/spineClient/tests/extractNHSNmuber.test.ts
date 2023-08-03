import {extractNHSNumber} from "../src/extractNHSNmuber"
import "jest"

describe("extract nhs number", () => {
  test("Throws error when no values passed in", () => {
    expect(extractNHSNumber).toThrow("nhsloginUser not passed in")
  })

  test("should throw an error if called without a string that cant be split", () => {
    expect(() => {
      extractNHSNumber("45")
    }).toThrow("NHS Number failed preflight checks")
  })

  test("should throw an error if called with a string for NHS number", () => {
    expect(() => {
      extractNHSNumber("P9:A")
    }).toThrow("NHS Number failed preflight checks")
  })

  test("should throw an error if called with a short NHS number", () => {
    expect(() => {
      extractNHSNumber("P9:123")
    }).toThrow("NHS Number failed preflight checks")
  })

  test("should throw an error if not a P9 auth level", () => {
    expect(() => {
      extractNHSNumber("P1:9912003071")
    }).toThrow("Identity proofing level is not P9")
  })

  test("should throw an error if invalid check digit", () => {
    expect(() => {
      extractNHSNumber("P9:9912003070")
    }).toThrow("invalid check digit in NHS number")
  })

  test("should return nhs number for valid input", () => {
    const nhsNumber = extractNHSNumber("P9:9912003071")
    expect(nhsNumber).toBe("9912003071")
  })
})
