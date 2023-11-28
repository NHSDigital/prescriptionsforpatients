import {Logger} from "@aws-lambda-powertools/logger"
import {validateUrl} from "../src/validateUrl"
import "jest"

type testData = {url: string | undefined, scenarioDescription: string, expected: boolean}

describe("test URL protocols", () => {
  const logger = new Logger({serviceName: "validateUrl"})
  it.each<testData>([
    {
      url: "http://www.pharmacy2u.co.uk",
      scenarioDescription: "url starts with http",
      expected: true
    },
    {
      url: "https://www.pharmacy2u.co.uk",
      scenarioDescription: "url starts with https",
      expected: true
    },
    {
      url: "www.pharmacy2u.co.uk",
      scenarioDescription: "url has no protocol",
      expected: false
    },
    {
      url: "invalid://www.pharmacy2u.co.uk",
      scenarioDescription: "url has an unsupported protocol",
      expected: false
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const isValid = validateUrl(url, logger)
    expect(isValid).toBe(expected)
  })
})

describe("test URL undefined", () => {
  const logger = new Logger({serviceName: "validateUrl"})
  it.each<testData>([
    {
      url: undefined,
      scenarioDescription: "url is undefined",
      expected: false
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const isValid = validateUrl(url, logger)
    expect(isValid).toBe(expected)
  })
})

describe("test URL path", () => {
  const logger = new Logger({serviceName: "validateUrl"})
  it.each<testData>([
    {
      url: "https://www.pharmacy2u.co.uk/path/goes/here",
      scenarioDescription: "url has a path",
      expected: true
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const isValid = validateUrl(url, logger)
    expect(isValid).toBe(expected)
  })
})

describe("test URL queries", () => {
  const logger = new Logger({serviceName: "validateUrl"})
  it.each<testData>([
    {
      url: "https://www.pharmacy2u.co.uk/search?query=what",
      scenarioDescription: "url has a single query",
      expected: true
    },
    {
      url: "https://www.pharmacy2u.co.uk/search?query=what&another=why",
      scenarioDescription: "url has a double query",
      expected: true
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const isValid = validateUrl(url, logger)
    expect(isValid).toBe(expected)
  })
})
