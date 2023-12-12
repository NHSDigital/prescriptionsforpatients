import {LiveServiceSearchClient, ServiceSearchData} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

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

  test.each<ServiceSearchTestData>([
    {
      scenarioDescription: "distance selling and valid url",
      serviceSearchData: {value: [{URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
      expected: new URL("https://www.pharmacy2u.co.uk")
    },
    {
      scenarioDescription: "distance selling and invalid url",
      serviceSearchData: {value: [{URL: "www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
      expected: undefined
    },
    {
      scenarioDescription: "not distance selling and valid url",
      serviceSearchData: {
        value: [{
          URL: "https://www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }]
      },
      expected: new URL("https://www.netmums.com/local/l/london-speech-therapy")
    },
    {
      scenarioDescription: "not distance selling and invalid url",
      serviceSearchData: {
        value: [{
          URL: "www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }]
      },
      expected: undefined
    },
    {
      scenarioDescription: "no results in response",
      serviceSearchData: {value: []},
      expected: undefined
    }
  ])("$scenarioDescription", async ({serviceSearchData: serviceData, expected}) => {
    mock.onGet("https://live/service-search").reply(200, serviceData)
    const result = await serviceSearchClient.searchService("")
    expect(expected).toEqual(result)
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
