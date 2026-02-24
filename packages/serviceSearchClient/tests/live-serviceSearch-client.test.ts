import {LiveServiceSearchClient, ServiceSearch3Data} from "../src/live-serviceSearch-client"
import {jest} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockPharmacy2uResponse} from "@pfp-common/testing"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "live"
process.env.ServiceSearch3ApiKey = "test-key"
const serviceSearchUrl = "https://live/service-search-api/"
const dummyCorrelationId = "corr-id-123"
const DISTANCE_SELLING = "DistanceSelling"
const EXAMPLE_URL = "https://example.com"

interface ServiceSearchTestData {
  scenarioDescription: string
  serviceSearchData: ServiceSearch3Data
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

  // Helper function tests
  test("getServiceSearchEndpoint returns v3 URL", async () => {
    const {getServiceSearchEndpoint} = await import("../src/live-serviceSearch-client.js")
    const endpoint = getServiceSearchEndpoint()
    expect(endpoint).toBe(serviceSearchUrl)
  })

  test("getServiceSearchVersion returns 3 and logs info", async () => {
    const infoSpy = jest.spyOn(Logger.prototype, "info")
    const {getServiceSearchVersion} = await import("../src/live-serviceSearch-client.js")
    const version = getServiceSearchVersion(logger)
    expect(version).toBe(3)
    expect(infoSpy).toHaveBeenCalledWith("Service search v3 enabled")
  })

  test("stripApiKeyFromHeaders removes only apikey header", () => {
    const axiosErr: AxiosError = {
      isAxiosError: true,
      config: {
        headers: new axios.AxiosHeaders({"apikey": "secret", keep: "yes"})
      } satisfies AxiosRequestConfig,
      response: {
        headers: {"apikey": "secret", foo: "bar"},
        data: null,
        status: 200,
        statusText: "",
        config: {headers: new axios.AxiosHeaders()} satisfies AxiosRequestConfig,
        request: {}
      } satisfies AxiosResponse,
      request: {
        headers: {"apikey": "secret", keep: "yes"}
      },
      toJSON: function (): object {
        throw new Error("Function not implemented.")
      },
      name: "",
      message: ""
    }

    expect(axiosErr.config!.headers).toHaveProperty("apikey")
    expect(axiosErr.request!.headers).toHaveProperty("apikey")
    expect(axiosErr.response!.headers).toHaveProperty("apikey")

    client.stripApiKeyFromHeaders(axiosErr)

    // The config doesn't get touched by the stripping function
    expect(axiosErr.config!.headers).toHaveProperty("apikey")
    expect(axiosErr.config!.headers).toHaveProperty("keep", "yes")
    expect(axiosErr.request!.headers).not.toHaveProperty("apikey")
    expect(axiosErr.request!.headers).toHaveProperty("keep", "yes")
    expect(axiosErr.response!.headers).not.toHaveProperty("apikey")
    expect(axiosErr.response!.headers).toHaveProperty("foo", "bar")
  })

  // Test non-Axios exception path
  test("searchService logs and rethrows non-Axios error", async () => {
    jest.spyOn(client["axiosInstance"], "get").mockImplementation(() => {
      throw new Error("generic fail")
    })
    const errSpy = jest.spyOn(Logger.prototype, "error")

    await expect(client.searchService("code123", dummyCorrelationId)).rejects.toThrow("generic fail")
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

    await expect(client.searchService("x", dummyCorrelationId)).rejects.toBe(axiosErr)
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

    await expect(client.searchService("y", dummyCorrelationId)).rejects.toBe(axiosErr)
    expect(errSpy).toHaveBeenCalledWith(
      "error in request to serviceSearch", {error: axiosErr}
    )
  })

  // Test AxiosError without response or request (general axios error)
  test("searchService logs general axios error when no response or request", async () => {
    const axiosErr = {
      isAxiosError: true,
      message: "generalfail",
      config: {headers: {}},
      request: undefined,
      response: undefined
    } as unknown as AxiosError

    jest.spyOn(client["axiosInstance"], "get").mockRejectedValue(axiosErr)
    const errSpy = jest.spyOn(Logger.prototype, "error")

    await expect(client.searchService("y", dummyCorrelationId)).rejects.toBe(axiosErr)
    expect(errSpy).toHaveBeenCalledWith(
      "general error calling serviceSearch", {error: axiosErr}
    )
  })

  test("passes correlation ID and x-request-id header in request", async () => {
    const getSpy = jest.spyOn(client["axiosInstance"], "get").mockResolvedValue({
      data: {value: []},
      status: 200,
      statusText: "OK",
      headers: {},
      config: {
        headers: new axios.AxiosHeaders()}
    } satisfies AxiosResponse)

    await client.searchService("corr-test", dummyCorrelationId)

    expect(getSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-correlation-id": dummyCorrelationId,
          "x-request-id": expect.any(String)
        })
      })
    )
  })
  describe("integration scenarios", () => {
    const validUrlData: ServiceSearch3Data = {
      "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
      value: [
        {
          "@search.score": 1,
          OrganisationSubType: DISTANCE_SELLING,
          Contacts: [{ContactMethodType: "Website", ContactValue: EXAMPLE_URL}]
        }
      ]
    }

    const scenarios: Array<ServiceSearchTestData> = [
      {
        scenarioDescription: "valid url",
        serviceSearchData: validUrlData,
        expected: new URL(EXAMPLE_URL)
      },
      {
        scenarioDescription: "missing protocol",
        serviceSearchData: {
          "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
          value: [{
            "@search.score": 1,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: [{ContactMethodType: "Website", ContactValue: "example.com"}]
          }]
        },
        expected: new URL(EXAMPLE_URL)
      },
      {
        scenarioDescription: "no results",
        serviceSearchData: {
          "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services", value: []
        },
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
      const result = await client.searchService("z", dummyCorrelationId)
      expect(result).toEqual(expected)
    })

    test("gzip header handled correctly", async () => {
      mock.onGet(serviceSearchUrl).reply(200, validUrlData, {"Content-Encoding": "gzip"})
      const result = await client.searchService("z", dummyCorrelationId)
      expect(result).toEqual(new URL(EXAMPLE_URL))
    })

    test("retries up to 3 times", async () => {
      mock.onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).replyOnce(500)
        .onGet(serviceSearchUrl).reply(200, validUrlData)
      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      client = new LiveServiceSearchClient(logger)

      const result = await client.searchService("z", dummyCorrelationId)
      expect(result).toEqual(new URL(EXAMPLE_URL))
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Call to serviceSearch failed - retrying. Retry count"),
        expect.objectContaining({retryCount: 1})
      )
    })

    test("fails after exceeding retries", async () => {
      mock.onGet(serviceSearchUrl).reply(500)
      await expect(client.searchService("z", dummyCorrelationId)).rejects.toThrow("Request failed with status code 500")
    })

    test("retries on timeout (ECONNABORTED) error", async () => {
      mock.onGet(serviceSearchUrl).timeoutOnce()
        .onGet(serviceSearchUrl).timeoutOnce()
        .onGet(serviceSearchUrl).timeoutOnce()
        .onGet(serviceSearchUrl).reply(200, validUrlData)
      const result = await client.searchService("z", dummyCorrelationId)
      expect(result).toEqual(new URL(EXAMPLE_URL))
    })

    test("logs duration in info on success and failure", async () => {
      const infoSpy = jest.spyOn(Logger.prototype, "info")
      mock.onGet(serviceSearchUrl).networkError()
      await expect(client.searchService("z", dummyCorrelationId)).rejects.toThrow("Network Error")
      expect(infoSpy).toHaveBeenCalledWith(
        "serviceSearch request duration",
        {serviceSearch_duration: expect.any(Number)}
      )
    })

    test("warns on null URL without error", async () => {
      mock.onGet(serviceSearchUrl).reply(200, {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [{"@search.score": 1, OrganisationSubType: DISTANCE_SELLING, Contacts: []}]
      })
      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const errorSpy = jest.spyOn(Logger.prototype, "error")
      const result = await client.searchService("none", dummyCorrelationId)
      expect(result).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(
        "ods code none has no contact info but is of type DistanceSelling", {odsCode: "none"}
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
      await expect(client.searchService("Z123", dummyCorrelationId))
        .rejects.toThrow("Axios error in serviceSearch request")

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

  describe("handleV3Response", () => {
    test("returns URL from Website contact", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: [
              {ContactMethodType: "Website", ContactValue: EXAMPLE_URL}
            ]
          }
        ]
      }

      const result = client.handleV3Response("TEST123", data)
      expect(result).toEqual(new URL(EXAMPLE_URL))
    })

    test("returns undefined when response has no Contacts", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: []
          }
        ]
      }

      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const result = client.handleV3Response("TEST123", data)

      expect(warnSpy).toHaveBeenCalledWith(
        "pharmacy with ods code TEST123 has no website",
        {odsCode: "TEST123"}
      )
      expect(result).toBeUndefined()
    })

    test("returns undefined when response has no Website contact", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: [
              {ContactMethodType: "Phone", ContactValue: "01234567890"},
              {ContactMethodType: "Email", ContactValue: "test@example.com"}
            ]
          }
        ]
      }

      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const result = client.handleV3Response("TEST123", data)

      expect(warnSpy).toHaveBeenCalledWith(
        "pharmacy with ods code TEST123 has no website",
        {odsCode: "TEST123"}
      )
      expect(result).toBeUndefined()
    })

    test("handles URL without protocol", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: [
              {ContactMethodType: "Website", ContactValue: "example.com"}
            ]
          }
        ]
      }

      const result = client.handleV3Response("TEST123", data)
      expect(result).toEqual(new URL(EXAMPLE_URL))
    })

    test("returns undefined when value array is empty", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: []
      }

      const result = client.handleV3Response("TEST123", data)
      expect(result).toBeUndefined()
    })

    test("finds Website contact among multiple contacts", () => {
      const data: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: DISTANCE_SELLING,
            Contacts: [
              {ContactMethodType: "Phone", ContactValue: "01234567890"},
              {ContactMethodType: "Website", ContactValue: "https://pharmacy.example.com"},
              {ContactMethodType: "Email", ContactValue: "test@example.com"}
            ]
          }
        ]
      }

      const result = client.handleV3Response("TEST123", data)
      expect(result).toEqual(new URL("https://pharmacy.example.com"))
    })
  })
})
