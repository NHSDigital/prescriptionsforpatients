import {LiveServiceSearchClient, ServiceSearchData, SERVICE_SEARCH_TIMEOUT} from "../src/live-serviceSearch-client"
import {jest} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockPharmacy2uResponse} from "@prescriptionsforpatients_common/testing"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "live"
const serviceSearchUrl = "https://live/service-search"

type ServiceSearchTestData = {
  scenarioDescription: string
  serviceSearchData: ServiceSearchData
  expected: URL | undefined
}

describe("live serviceSearch client", () => {
  let logger: Logger
  let serviceSearchClient: LiveServiceSearchClient

  beforeEach(() => {
    logger = new Logger({serviceName: "serviceSearchClient"})
    serviceSearchClient = new LiveServiceSearchClient(logger)
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
    mock.onGet(serviceSearchUrl).reply(200, serviceData)
    const result = await serviceSearchClient.searchService("")
    expect(result).toEqual(expected)
  })

  test("gzip header doesn't affect non-gzipped response (staging)", async () => {
    mock.onGet(serviceSearchUrl).reply(200, validUrl.serviceSearchData, {"Content-Encoding": "gzip"})
    const result = await serviceSearchClient.searchService("")
    expect(result).toEqual(validUrl.expected)
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet(serviceSearchUrl).networkError()
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Network Error")
  })

  test("should throw error when timeout on http request", async () => {
    mock.onGet(serviceSearchUrl).timeout()
    const mockLoggerError = jest.spyOn(Logger.prototype, "error")
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("timeout of 45000ms exceeded")

    expect(mockLoggerError).toHaveBeenCalledWith("serviceSearch request timed out", {
      odsCode: "",
      timeout: SERVICE_SEARCH_TIMEOUT
    })
  })

  test("should retry thrice when unsuccessful http requests", async () => {
    mock
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .reply(200, validUrl.serviceSearchData)
    const result = await serviceSearchClient.searchService("")
    expect(result).toEqual(validUrl.expected)
  })

  test("should throw when unsuccessful http requests exceeds configured retries", async () => {
    mock
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .replyOnce(500, {})
      .onGet(serviceSearchUrl)
      .reply(200, validUrl.serviceSearchData)
    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Request failed with status code 500")
  })

  test("log response time on successful call", async () => {
    mock.onGet(serviceSearchUrl).reply(200, {value: []})
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")

    await serviceSearchClient.searchService("")

    expect(mockLoggerInfo).toHaveBeenCalledWith("serviceSearch request duration", {
      serviceSearch_duration: expect.any(Number)
    })
  })

  test("log response time on unsuccessful call", async () => {
    mock.onGet(serviceSearchUrl).reply(401, {value: []})
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")

    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Request failed with status code 401")

    expect(mockLoggerInfo).toHaveBeenCalledWith("serviceSearch request duration", {
      serviceSearch_duration: expect.any(Number)
    })
  })

  test("log response time on network error call", async () => {
    mock.onGet(serviceSearchUrl).networkError()
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")

    await expect(serviceSearchClient.searchService("")).rejects.toThrow("Network Error")

    expect(mockLoggerInfo).toHaveBeenCalledWith("serviceSearch request duration", {
      serviceSearch_duration: expect.any(Number)
    })
  })

  test("handle null url", async () => {
    mock.onGet(serviceSearchUrl).reply(200, {value: [{URL: null, OrganisationSubType: "DistanceSelling"}]})
    const mockLoggerWarn = jest.spyOn(Logger.prototype, "warn")
    const mockLoggerError = jest.spyOn(Logger.prototype, "error")
    const result = await serviceSearchClient.searchService("no_url")
    expect(result).toEqual(undefined)
    expect(mockLoggerWarn).toHaveBeenCalledWith("ods code no_url has no URL but is of type DistanceSelling", {
      odsCode: "no_url"
    })
    expect(mockLoggerError).not.toHaveBeenCalled()
  })
})
