import {LiveServiceSearchClient, ServiceSearchResponse} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "serviceSearch"

type serviceSearchTestData = {
  scenarioDescription: string
  serviceData: {value: [{URL: string, OrganisationSubType: string}] | []}
  expected: ServiceSearchResponse
}

describe("live serviceSearch client", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})
  const serviceSearchClient = new LiveServiceSearchClient(logger)

  afterEach(() => {
    mock.reset()
  })

  test.each<serviceSearchTestData>([
    {
      scenarioDescription: "distance selling and valid url",
      serviceData: {value: [{URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
      expected: {serviceUrl: "https://www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: true}
    },
    {
      scenarioDescription: "distance selling and invalid url",
      serviceData: {value: [{URL: "www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}]},
      expected: {serviceUrl: "www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: false}
    },
    {
      scenarioDescription: "not distance selling and valid url",
      serviceData: {
        value: [{
          URL: "https://www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }]
      },
      expected: {
        serviceUrl: "https://www.netmums.com/local/l/london-speech-therapy",
        isDistanceSelling: false,
        urlValid: true
      }
    },
    {
      scenarioDescription: "not distance selling and invalid url",
      serviceData: {
        value: [{
          URL: "www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }]
      },
      expected: {
        serviceUrl: "www.netmums.com/local/l/london-speech-therapy",
        isDistanceSelling: false,
        urlValid: false
      }
    },
    {
      scenarioDescription: "no results in response",
      serviceData: {value: []},
      expected: {serviceUrl: "", isDistanceSelling: false, urlValid: false}
    }
  ])("$scenarioDescription", async ({serviceData, expected}) => {
    mock.onGet("https://serviceSearch/service-search").reply(200, serviceData)
    const result = await serviceSearchClient.searchService("")
    expect(expected).toEqual(result)
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://serviceSearch/service-search").networkError()
    const serviceSearchClient = new LiveServiceSearchClient(logger)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Network Error")
  })

  test("should throw error when timeout on http request", async () => {
    mock.onGet("https://serviceSearch/service-search").timeout()
    const serviceSearchClient = new LiveServiceSearchClient(logger)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
