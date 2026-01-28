import {LiveServiceSearchClient, ServiceSearchData, ServiceSearch3Data} from "../src/live-serviceSearch-client"
import {jest} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {mockPharmacy2uResponse} from "@pfp-common/testing"

const mock = new MockAdapter(axios)

process.env.TargetServiceSearchServer = "live"
process.env.ServiceSearchApiKey = "test-key"
const serviceSearchUrl = "https://live/service-search"

interface ServiceSearchTestData {
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

  // Helper function tests
  test("getServiceSearchEndpoint returns correct URL for v2", async () => {
    const {getServiceSearchEndpoint} = await import("../src/live-serviceSearch-client.js")
    const endpoint = getServiceSearchEndpoint()
    expect(endpoint).toBe(serviceSearchUrl)
  })

  test("getServiceSearchEndpoint returns correct URL for v3", async () => {
    process.env.TargetServiceSearchServer = "api.service.nhs.uk"
    const {getServiceSearchEndpoint} = await import("../src/live-serviceSearch-client.js")
    const endpoint = getServiceSearchEndpoint(logger)
    expect(endpoint).toBe("https://api.service.nhs.uk/service-search-api/")
    process.env.TargetServiceSearchServer = "live"
  })

  test("getServiceSearchVersion returns 3 and logs info for v3 endpoint", async () => {
    process.env.TargetServiceSearchServer = "api.service.nhs.uk"
    const infoSpy = jest.spyOn(Logger.prototype, "info")
    const {getServiceSearchVersion} = await import("../src/live-serviceSearch-client.js")
    const version = getServiceSearchVersion(logger)
    expect(version).toBe(3)
    expect(infoSpy).toHaveBeenCalledWith("Using service search v3 endpoint")
    process.env.TargetServiceSearchServer = "live"
  })

  test("getServiceSearchVersion returns 2 and logs warn for v2 endpoint", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn")
    const {getServiceSearchVersion} = await import("../src/live-serviceSearch-client.js")
    const version = getServiceSearchVersion(logger)
    expect(version).toBe(2)
    expect(warnSpy).toHaveBeenCalledWith("Using service search v2 endpoint")
  })

  test("stripKeyFromHeaders removes only subscription-key header", () => {
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

    await expect(client.searchService("y")).rejects.toBe(axiosErr)
    expect(errSpy).toHaveBeenCalledWith(
      "general error calling serviceSearch", {error: axiosErr}
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

  describe("v3 service search integration", () => {
    const v3ServiceSearchUrl = "https://api.service.nhs.uk/service-search-api/"
    const validV3Data: ServiceSearch3Data = {
      "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
      value: [
        {
          "@search.score": 1.0,
          OrganisationSubType: "DistanceSelling",
          Contacts: [
            {ContactMethodType: "Website", ContactValue: "https://example.com"}
          ]
        }
      ]
    }

    beforeEach(() => {
      process.env.TargetServiceSearchServer = "api.service.nhs.uk"
      process.env.ServiceSearch3ApiKey = "v3-test-key"
    })

    afterEach(() => {
      process.env.TargetServiceSearchServer = "live"
      delete process.env.ServiceSearch3ApiKey
      jest.restoreAllMocks()
    })

    test("uses v3 endpoint and apikey header", async () => {
      const infoSpy = jest.spyOn(Logger.prototype, "info")

      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, validV3Data)

      const result = await v3Client.searchService("test-ods")

      expect(infoSpy).toHaveBeenCalledWith("Using service search v3 endpoint")
      expect(infoSpy).toHaveBeenCalledWith(
        "ServiceSearchClient configured",
        {v2: true, v3: true}
      )
      expect(result).toEqual(new URL("https://example.com"))
    })

    test("logs error when API key ARN is not set and API key is missing", async () => {
      delete process.env.ServiceSearch3ApiKey
      delete process.env.ServiceSearch3ApiKeyARN

      const errorSpy = jest.spyOn(Logger.prototype, "error")

      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, validV3Data)

      const result = await v3Client.searchService("test-ods")

      expect(errorSpy).toHaveBeenCalledWith(
        "ServiceSearch3ApiKeyARN environment variable is not set"
      )
      expect(result).toEqual(new URL("https://example.com"))
    })

    test("attempts to load from secrets manager when API key is not in environment", async () => {
      delete process.env.ServiceSearch3ApiKey
      process.env.ServiceSearch3ApiKeyARN = "arn:aws:secretsmanager:region:account:secret:test"

      const infoSpy = jest.spyOn(Logger.prototype, "info")
      const errorSpy = jest.spyOn(Logger.prototype, "error")

      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, validV3Data)

      const result = await v3Client.searchService("test-ods")

      expect(infoSpy).toHaveBeenCalledWith(
        "API key not in environment, attempting to load from Secrets Manager"
      )
      // Since getSecret will actually fail in the test environment, we should see an error
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to load ServiceSearch API key from Secrets Manager",
        expect.objectContaining({error: expect.anything()})
      )
      expect(result).toEqual(new URL("https://example.com"))
    })

    test("returns undefined when v3 response has no Contacts", async () => {
      const noContactsData: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: "DistanceSelling",
            Contacts: []
          }
        ]
      }

      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, noContactsData)

      const result = await v3Client.searchService("test-ods")

      expect(warnSpy).toHaveBeenCalledWith(
        "pharmacy with ods code test-ods has no website",
        {odsCode: "test-ods"}
      )
      expect(result).toBeUndefined()
    })

    test("returns undefined when v3 response has no Website contact", async () => {
      const noWebsiteData: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: "DistanceSelling",
            Contacts: [
              {ContactMethodType: "Phone", ContactValue: "01234567890"}
            ]
          }
        ]
      }

      const warnSpy = jest.spyOn(Logger.prototype, "warn")
      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, noWebsiteData)

      const result = await v3Client.searchService("test-ods")

      expect(warnSpy).toHaveBeenCalledWith(
        "pharmacy with ods code test-ods has no website",
        {odsCode: "test-ods"}
      )
      expect(result).toBeUndefined()
    })

    test("handles v3 URL without protocol", async () => {
      const noProtocolData: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: [
          {
            "@search.score": 1.0,
            OrganisationSubType: "DistanceSelling",
            Contacts: [
              {ContactMethodType: "Website", ContactValue: "example.com"}
            ]
          }
        ]
      }

      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, noProtocolData)

      const result = await v3Client.searchService("test-ods")

      expect(result).toEqual(new URL("https://example.com"))
    })

    test("returns undefined when v3 response has empty value array", async () => {
      const emptyData: ServiceSearch3Data = {
        "@odata.context": "https://api.service.nhs.uk/service-search-api/$metadata#Services",
        value: []
      }

      const v3Client = new LiveServiceSearchClient(logger)
      mock.onGet(v3ServiceSearchUrl).reply(200, emptyData)

      const result = await v3Client.searchService("test-ods")

      expect(result).toBeUndefined()
    })
  })
})
