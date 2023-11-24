import {serviceHealthCheck} from "../src/status"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Agent} from "https"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)

describe("Health check", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})
  const httpsAgent = new Agent()

  afterEach(() => {
    mock.reset()
  })

  test("Successful health check result returns success", async () => {
    mock.onGet("/healthcheck").reply(200, {})

    const serviceSearchResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent)

    expect(serviceSearchResponse.status).toBe("pass")
    expect(serviceSearchResponse.responseCode).toBe(200)
    expect(serviceSearchResponse.links).toBe("healthcheck")
    expect(serviceSearchResponse.timeout).toBe("false")
  })

  test("Failure health check result returns failure", async () => {
    mock.onGet("/healthcheck").reply(500, {})

    const serviceSearchResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent)

    expect(serviceSearchResponse.status).toBe("error")
    expect(serviceSearchResponse.responseCode).toBe(500)
    expect(serviceSearchResponse.links).toBe("healthcheck")
    expect(serviceSearchResponse.timeout).toBe("false")
  })

  test("health check network issues result returns failure", async () => {
    mock.onGet("/healthcheck").networkError()

    const serviceSearchResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent)

    expect(serviceSearchResponse.status).toBe("error")
    expect(serviceSearchResponse.responseCode).toBe(500)
    expect(serviceSearchResponse.links).toBe("healthcheck")
    expect(serviceSearchResponse.timeout).toBe("false")
  })
})
