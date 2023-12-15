import {LiveServiceSearchClient, ServiceSearchData} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockServiceSearchResponseBody} from "@prescriptionsforpatients_common/testing"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "live"

type ServiceSearchTestData = {
  scenarioDescription: string
  serviceSearchData: ServiceSearchData
  expected: URL | undefined
}

describe("live serviceSearch client", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})
  const serviceSearchClient = new LiveServiceSearchClient(logger)

  afterEach(() => {
    mock.reset()
  })

  const validUrl: ServiceSearchTestData = {
    scenarioDescription: "valid url",
    serviceSearchData: {value: [{URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
    expected: new URL("https://www.pharmacy2u.co.uk")
  }

  test.each<ServiceSearchTestData>([
    validUrl,
    {
      scenarioDescription: "valid url with missing protocol",
      serviceSearchData: {value: [{URL: "www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
      expected: new URL("https://www.pharmacy2u.co.uk")
    },
    {
      scenarioDescription: "no results in response",
      serviceSearchData: {value: []},
      expected: undefined
    },
    {
      scenarioDescription: "canned service search response",
      serviceSearchData: mockServiceSearchResponseBody,
      expected: new URL("https://www.pharmacy2u.co.uk")
    }
  ])("$scenarioDescription", async ({serviceSearchData: serviceData, expected}) => {
    mock.onGet("https://live/service-search").reply(200, serviceData)
    const result = await serviceSearchClient.searchService("")
    expect(expected).toEqual(result)
  })

  test("gzip header doesn't affect non-gzipped response (staging)", async () => {
    mock.onGet("https://live/service-search").reply(200, validUrl.serviceSearchData, {"Content-Encoding": "gzip"})
    const result = await serviceSearchClient.searchService("")
    expect(validUrl.expected).toEqual(result)
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://live/service-search").networkError()
    const serviceSearchClient = new LiveServiceSearchClient(logger)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Network Error")
  })

  test("should throw error when timeout on http request", async () => {
    mock.onGet("https://live/service-search").timeout()
    const serviceSearchClient = new LiveServiceSearchClient(logger)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
