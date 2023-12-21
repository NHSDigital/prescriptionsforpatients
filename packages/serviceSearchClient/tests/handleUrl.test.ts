import "jest"
import {handleUrl} from "../src/handleUrl"
import {Logger} from "@aws-lambda-powertools/logger"

type testData = {url: string, scenarioDescription: string, expected: URL | undefined}

describe("test URL protocols", () => {
  const logger = new Logger({serviceName: "handleUrl"})
  const insecureProtocol = "https://www.pharmacy2u.co.uk".replace("s", "")
  test.each<testData>([
    {
      url: insecureProtocol,
      scenarioDescription: "insecure protocol",
      expected: new URL(insecureProtocol)
    },
    {
      url: "https://www.pharmacy2u.co.uk",
      scenarioDescription: "secure protocol",
      expected: new URL("https://www.pharmacy2u.co.uk")
    },
    {
      url: "www.pharmacy2u.co.uk",
      scenarioDescription: "no protocol",
      expected: new URL("https://www.pharmacy2u.co.uk")
    },
    {
      url: "invalid://www.pharmacy2u.co.uk",
      scenarioDescription: "unsupported protocol",
      expected: undefined
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const handled = handleUrl(url, "", logger)
    expect(handled).toStrictEqual(expected)
  })
})

describe("test URL paths", () => {
  const logger = new Logger({serviceName: "handleUrl"})
  test.each<testData>([
    {
      url: "https://www.pharmacy2u.co.uk/path/goes/here",
      scenarioDescription: "url has a path",
      expected: new URL("https://www.pharmacy2u.co.uk/path/goes/here")
    },
    {
      url: "https://www.pharmacy2u.co.uk/path/with-hyphen",
      scenarioDescription: "url has a path with a hyphen",
      expected: new URL("https://www.pharmacy2u.co.uk/path/with-hyphen")
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const handled = handleUrl(url, "", logger)
    expect(handled).toStrictEqual(expected)
  })
})

describe("test URL queries", () => {
  const logger = new Logger({serviceName: "handleUrl"})
  test.each<testData>([
    {
      url: "https://www.pharmacy2u.co.uk/search?query=what",
      scenarioDescription: "url has a single query",
      expected: new URL("https://www.pharmacy2u.co.uk/search?query=what")
    },
    {
      url: "https://www.pharmacy2u.co.uk/search?query=what&another=why",
      scenarioDescription: "url has a double query",
      expected: new URL("https://www.pharmacy2u.co.uk/search?query=what&another=why")
    }
  ])("return $expected when $scenarioDescription", ({url, expected}) => {
    const handled = handleUrl(url, "", logger)
    expect(handled).toStrictEqual(expected)
  })
})
