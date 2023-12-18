import {LiveServiceSearchClient, ServiceSearchData} from "../src/live-serviceSearch-client"
import {jest} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios, {AxiosHeaders} from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockPharmacy2uResponse} from "@prescriptionsforpatients_common/testing"

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
      serviceSearchData: mockPharmacy2uResponse,
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

  test("should not log api key when error response", async () => {
    const mockLoggerError = jest.spyOn(Logger.prototype, "error")
    mock.onGet("https://live/service-search").reply(
      500, {message: "error data"}, {"subscription-key": "api-key", "other": "other"}
    )
    const serviceSearchClient = new LiveServiceSearchClient(logger)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Request failed with status code 500")

    const expectedHeaders: AxiosHeaders = new AxiosHeaders({other: "other"})
    expect(mockLoggerError).toHaveBeenCalledWith(
      "error in response from serviceSearch",
      {
        request: expect.any(Object),
        response: {
          Headers: expectedHeaders,
          data: {
            message: "error data"
          },
          status: 500
        }
      }
    )
  })

  test("successful log response time", async () => {
    mock.onGet("https://live/service-search").reply(200, {value: []})
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
    const serviceSearchClient = new LiveServiceSearchClient(logger)

    await serviceSearchClient.searchService("")

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "serviceSearch request duration", {"serviceSearch_duration": expect.any(Number)}
    )
  })
})
