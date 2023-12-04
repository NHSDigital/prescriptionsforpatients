import {serviceHealthCheck} from "../src/status"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)
const axiosInstance = axios.create()

describe("Health check", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})

  afterEach(() => {
    mock.reset()
  })

  test("Successful health check result returns success", async () => {
    mock.onGet("/service-search").reply(200, {})

    const serviceSearchResponse = await serviceHealthCheck("service-search", logger, {}, axiosInstance)

    expect(serviceSearchResponse.status).toBe("pass")
    expect(serviceSearchResponse.responseCode).toBe(200)
    expect(serviceSearchResponse.timeout).toBe("false")
  })

  test("Failure health check result returns failure", async () => {
    mock.onGet("/service-search").reply(500, {})

    const serviceSearchResponse = await serviceHealthCheck("service-search", logger, {}, axiosInstance)

    expect(serviceSearchResponse.status).toBe("error")
    expect(serviceSearchResponse.responseCode).toBe(500)
    expect(serviceSearchResponse.timeout).toBe("false")
  })

  test("health check network issues result returns failure", async () => {
    mock.onGet("/service-search").networkError()

    const serviceSearchResponse = await serviceHealthCheck("service-search", logger, {}, axiosInstance)

    expect(serviceSearchResponse.status).toBe("error")
    expect(serviceSearchResponse.responseCode).toBe(500)
    expect(serviceSearchResponse.timeout).toBe("false")
  })
})
