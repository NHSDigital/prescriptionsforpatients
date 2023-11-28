import {LiveServiceSearchClient, ServiceSearchResponse} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)
process.env.TargetServiceSearchServer = "serviceSearch"
type serviceSearchFailureTestData = {
  httpResponseCode: number
  errorMessage: string
  scenarioDescription: string
}

describe("live serviceSearch client", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})

  afterEach(() => {
    mock.reset()
  })

  test("successful response when http response is status 200 and serviceUrl exists", async () => {
    const response = {value: {URL: "https://www.pharmacy2u.co.uk", OrganisationSubType: "DistanceSelling"}}
    mock.onGet("https://serviceSearch/service-search").reply(200, response)
    const serviceSearchClient = new LiveServiceSearchClient()
    const serviceData = await serviceSearchClient.searchService("", logger)

    const expected: ServiceSearchResponse = {
      serviceUrl: "https://www.pharmacy2u.co.uk", isDistanceSelling: true, urlValid: true
    }

    expect(serviceData).toStrictEqual(expected)
  })

  test.each<serviceSearchFailureTestData>([
    {
      httpResponseCode: 200,
      errorMessage: "Unsuccessful status code response from serviceSearch",
      scenarioDescription: "serviceSearch returns a non successful response status"
    }
  ])(
    "throw error when $scenarioDescription",
    async ({httpResponseCode, errorMessage}) => {
      mock.onGet("https://serviceSearch/service-search").reply(
        httpResponseCode, {value: {URL: "", OrganisationSubType: ""}}
      )
      const serviceSearchClient = new LiveServiceSearchClient()
      await expect(serviceSearchClient.searchService("", logger)).rejects.toThrow(errorMessage)
    }
  )

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://serviceSearch/service-search").networkError()
    const serviceSearchClient = new LiveServiceSearchClient()
    await expect(serviceSearchClient.searchService("", logger)).rejects.toThrow("Network Error")
  })

  test("should throw error when timout on http request", async () => {
    mock.onGet("https://serviceSearch/service-search").timeout()
    const serviceSearchClient = new LiveServiceSearchClient()
    await expect(serviceSearchClient.searchService("", logger)).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
