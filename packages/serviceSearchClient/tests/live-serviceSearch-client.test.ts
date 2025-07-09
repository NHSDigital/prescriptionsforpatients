import {LiveServiceSearchClient, ServiceSearchData} from "../src/live-serviceSearch-client"
import {jest} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockPharmacy2uResponse} from "@prescriptionsforpatients_common/testing"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "live"
process.env.ServiceSearchApiKey = "test-key"
const serviceSearchUrl = "https://live/service-search"

type ServiceSearchTestData = {
  scenarioDescription: string
  serviceSearchData: ServiceSearchData
  expected: URL | undefined
}

describe("live serviceSearch client", () => {
  let logger: Logger
  let client: LiveServiceSearchClient

  beforeEach(() => {
    logger = new Logger({serviceName: "svcClientTest"})
    client = new LiveServiceSearchClient(logger)
    mock.reset()
    jest.restoreAllMocks()
  })

  // Private helper tests
  test("getServiceSearchEndpoint returns correct URL", () => {
    const endpoint = client["getServiceSearchEndpoint"]()
    expect(endpoint).toBe(serviceSearchUrl)
  })

  test("stripApiKeyFromHeaders removes only subscription-key header", () => {
    const axiosErr: AxiosError = {
      isAxiosError: true,
      config: {
        headers: new axios.AxiosHeaders({"subscription-key": "secret", keep: "yes"})
      } satisfies AxiosRequestConfig,
      response: {
        headers: {"subscription-key": "secret", foo: "bar"},
        data: null,
        status: 200,
        statusText: "",
        config: {headers: new axios.AxiosHeaders()} satisfies AxiosRequestConfig,
        request: {}
      } satisfies AxiosResponse,
      toJSON: function (): object {
        throw new Error("Function not implemented.")
      },
      name: "",
      message: ""
    }

    expect(axiosErr.config!.headers).toHaveProperty("subscription-key")
    expect(axiosErr.response!.headers).toHaveProperty("subscription-key")

    client.stripApiKeyFromHeaders(axiosErr)

    // The config doesn't get touched by the stripping function
    expect(axiosErr.config!.headers).toHaveProperty("subscription-key")
    expect(axiosErr.config!.headers).toHaveProperty("keep", "yes")
    expect(axiosErr.response!.headers).not.toHaveProperty("subscription-key")
    expect(axiosErr.response!.headers).toHaveProperty("foo", "bar")
  })

  // Test non-Axios exception path
  test("searchService logs and rethrows non-Axios error", async () => {
    jest.spyOn(client["axiosInstance"], "get").mockImplementation(() => {
      throw new Error("generic fail")
    })
    const errSpy = jest.spyOn(Logger.prototype, "error")

    await expect(client.searchService("code123")).rejects.toThrow("generic fail")
    expect(errSpy).toHaveBeenCalledWith(
      "general error", {error: expect.any(Error)}
    )
  })

  // Test AxiosError with response
  test("searchService logs axios error with response details", async () => {
    const axiosErr = {
      isAxiosError: true,
      message: "failed",
      config: {headers: {}} satisfies AxiosRequestConfig,
      request: {path: "/service-search"},
      response: {
        data: {x: 1},
        status: 500,
        headers: {h: "v"},
        statusText: "Internal Server Error",
        config: {headers: new axios.AxiosHeaders()},
        request: {}
      } satisfies AxiosResponse
    } as unknown as AxiosError

    jest.spyOn(client["axiosInstance"], "get").mockRejectedValue(axiosErr)
    const errSpy = jest.spyOn(Logger.prototype, "error")

    await expect(client.searchService("x")).rejects.toBe(axiosErr)
    expect(errSpy).toHaveBeenCalledWith(
      "error in response from serviceSearch",
      expect.objectContaining({
        response: expect.objectContaining({status: 500}),
        request: expect.any(Object)
      })
    )
  })

  // Test AxiosError with request only
  test("searchService logs axios error with request details when no response", async () => {
    const axiosErr = {
      isAxiosError: true,
      message: "reqfail",
      config: {headers: {}},
      request: {detail: "reqError"},
      response: undefined
    } as unknown as AxiosError

    jest.spyOn(client["axiosInstance"], "get").mockRejectedValue(axiosErr)
    const errSpy = jest.spyOn(Logger.prototype, "error")

    await expect(client.searchService("y")).rejects.toBe(axiosErr)
    expect(errSpy).toHaveBeenCalledWith(
      "error in request to serviceSearch", {error: axiosErr}
    )
  })

  describe("integration scenarios", () => {
    const validUrlData: ServiceSearchData = {
      value: [
        {URL: "https://example.com", OrganisationSubType: "DistanceSelling"}
      ]
    }

    const scenarios: Array<ServiceSearchTestData> = [
      {
        scenarioDescription: "valid url",
        serviceSearchData: validUrlData,
        expected: new URL(validUrlData.value[0].URL)
      },
      {
        scenarioDescription: "missing protocol",
        serviceSearchData: {value: [{URL: "example.com", OrganisationSubType: "DistanceSelling"}]},
        expected: new URL("https://example.com")
      },
      {
        scenarioDescription: "no results",
        serviceSearchData: {value: []},
        expected: undefined
      },
      {
        scenarioDescription: "canned response",
        serviceSearchData: mockPharmacy2uResponse,
        expected: new URL("https://www.pharmacy2u.co.uk")
      }
    ]

    test.each(scenarios)("$scenarioDescription", async ({serviceSearchData, expected}) => {
      mock.onGet(serviceSearchUrl).reply(200, serviceSearchData)
      const result = await client.searchService("z")
      expect(result).toEqual(expected)
    })

    test("gzip header handled correctly", async () => {
      mock.onGet(serviceSearchUrl).reply(200, validUrlData, {"Content-Encoding": "gzip"})
      const result = await client.searchService("z")
      expect(result).toEqual(new URL(validUrlData.value[0].URL))
    })

    test("retries up to 3 times", async () => {
      mock.onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).reply(200, validUrlData)
      const result = await client.searchService("z")
      expect(result).toEqual(new URL(validUrlData.value[0].URL))
    })

    test("fails after exceeding retries", async () => {
      mock.onGet(serviceSearchUrl).reply(500)
      await expect(client.searchService("z")).rejects.toThrow("Request failed with status code 500")
    })

    test("logs duration in info on success and failure", async () => {
      const infoSpy = jest.spyOn(Logger.prototype, "info")
      mock.onGet(serviceSearchUrl).networkError()
      await expect(client.searchService("z")).rejects.toThrow("Network Error")
      expect(infoSpy).toHaveBeenCalledWith(
        "serviceSearch request duration",
        {serviceSearch_duration: expect.any(Number)}
      )
    })

    test("warns on null URL without error", async () => {
      mock.onGet(serviceSearchUrl).reply(200, {value: [{URL: null, OrganisationSubType: "DistanceSelling"}]})
      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const errorSpy = jest.spyOn(Logger.prototype, "error")
      const result = await client.searchService("none")
      expect(result).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(
        "ods code none has no URL but is of type DistanceSelling", {odsCode: "none"}
      )
      expect(errorSpy).not.toHaveBeenCalled()
    })

    test("searchService logs only the interesting data when a request is rejected", async () => {
    // this looks like AxiosError but is not an Error instance
      const axiosErr = {
        isAxiosError: true,
        message: "upstream service failed",
        config: {headers: {"request-startTime": 1234}},
        response: {
          data: "body-payload",
          status: 418,
          headers: {"x-test": "yes"},
          statusText: "",
          config: {},
          request: {}
        },
        request: {detail: "socket-timeout"},
        // these top-level props will be picked up by the interceptor
        data: "body-payload",
        status: 418,
        headers: {"x-test": "yes"}
      } as unknown as AxiosError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instanceMock = new MockAdapter((client as any)["axiosInstance"])
      instanceMock.onGet(serviceSearchUrl).reply(() => {
        throw axiosErr
      })

      const errSpy = jest.spyOn(Logger.prototype, "error")

      // invoking searchService should end up throwing the generic interceptor Error
      await expect(client.searchService("Z123")).rejects.toThrow("Axios error in serviceSearch request")

      expect(errSpy).toHaveBeenCalledWith(
        "Axios error in serviceSearch request",
        {
          axiosErrorDetails: {
            response: {
              data: "body-payload",
              status: 418,
              headers: {"x-test": "yes"}
            },
            request: {detail: "socket-timeout"}
          }
        }
      )
    })

  })
})
