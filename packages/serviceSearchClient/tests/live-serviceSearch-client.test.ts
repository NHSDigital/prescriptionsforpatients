import {LiveServiceSearchClient, ServiceSearchResponse} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "serviceSearch"

type serviceSearchTestData = {
  scenarioDescription: string
  serviceData: {value: {URL: string, OrganisationSubType: string}}
  expected: ServiceSearchResponse
}

describe("live serviceSearch client", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})
  const serviceSearchClient = new LiveServiceSearchClient()

  afterEach(() => {
    mock.reset()
  })

  test.each<serviceSearchTestData>([
    {
      scenarioDescription: "distance selling and valid url",
      serviceData: {value: {URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}},
      expected: {serviceUrl: "https://www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: true}
    },
    {
      scenarioDescription: "distance selling and invalid url",
      serviceData: {value: {URL: "www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}},
      expected: {serviceUrl: "www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: false}
    },
    {
      scenarioDescription: "not distance selling and valid url",
      serviceData: {
        value: {
          URL: "https://www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }
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
        value: {
          URL: "www.netmums.com/local/l/london-speech-therapy",
          OrganisationSubType: "Generic Directory of Services"
        }
      },
      expected: {
        serviceUrl: "www.netmums.com/local/l/london-speech-therapy",
        isDistanceSelling: false,
        urlValid: false
      }
    }
  ])("$scenarioDescription", async ({serviceData, expected}) => {
    mock.onGet("https://serviceSearch/service-search").reply(200, serviceData)
    const result = await serviceSearchClient.searchService("", logger)
    expect(expected).toEqual(result)
  })

  test("successful response when http response status from serviceSearch is 200", async () => {
    const response = {value: {URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}}
    mock.onGet("https://serviceSearch/service-search").reply(200, response)
    const serviceSearchClient = new LiveServiceSearchClient()
    const serviceData = await serviceSearchClient.searchService("", logger)

    const expected: ServiceSearchResponse = {
      serviceUrl: "https://www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: true
    }

    expect(serviceData).toStrictEqual(expected)
  })

  test("successful but false response when url returned by serviceSearch is invalid", async () => {
    const response = {value: {URL: "www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}}
    mock.onGet("https://serviceSearch/service-search").reply(200, response)
    const serviceSearchClient = new LiveServiceSearchClient()
    const serviceData = await serviceSearchClient.searchService("", logger)

    const expected: ServiceSearchResponse = {
      serviceUrl: "www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: false
    }

    expect(serviceData).toStrictEqual(expected)
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://serviceSearch/service-search").networkError()
    const serviceSearchClient = new LiveServiceSearchClient()
    await expect(serviceSearchClient.searchService("", logger)).rejects.toThrow("Network Error")
  })

  test("should throw error when timeout on http request", async () => {
    mock.onGet("https://serviceSearch/service-search").timeout()
    const serviceSearchClient = new LiveServiceSearchClient()
    await expect(serviceSearchClient.searchService("", logger)).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
