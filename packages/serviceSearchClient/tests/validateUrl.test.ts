import {Logger} from "@aws-lambda-powertools/logger"
import {validateUrl} from "../src/validateUrl"
import "jest"

type failureTestData = {url: string | undefined; scenarioDescription: string}

describe("failureTestData URL", () => {
  const logger = new Logger({serviceName: "validateUrl"})
  it.each<failureTestData>([
    {
      url: undefined,
      scenarioDescription: "url not passed in"
    },
    {
      url: "invalid.url",
      scenarioDescription: "url structure is invalid"
    }
  ])("throw error when $scenarioDescription", ({url}) => {
    const isValid = validateUrl(url, logger)
    expect(isValid).toBeFalsy()
  })

  test("should return true for valid url", () => {
    const serviceUrl = "http://www.pharmacy2u.co.uk"
    expect(validateUrl(serviceUrl, logger)).toBe(true)
  })
})
