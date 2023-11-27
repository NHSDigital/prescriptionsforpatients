import {serviceHealthCheck} from "../src/status"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Agent} from "https"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)
const axiosInstance = axios.create()

describe("Health check", () => {
  const logger = new Logger({serviceName: "spineClient"})
  const httpsAgent = new Agent()

  afterEach(() => {
    mock.reset()
  })

  test("Successful health check result returns success", async () => {
    mock.onGet("/healthcheck").reply(200, {})

    const spineResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent, axiosInstance)

    expect(spineResponse.status).toBe("pass")
    expect(spineResponse.responseCode).toBe(200)
    expect(spineResponse.links).toBe("healthcheck")
    expect(spineResponse.timeout).toBe("false")
  })

  test("Failure health check result returns failure", async () => {
    mock.onGet("/healthcheck").reply(500, {})

    const spineResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent, axiosInstance)

    expect(spineResponse.status).toBe("error")
    expect(spineResponse.responseCode).toBe(500)
    expect(spineResponse.links).toBe("healthcheck")
    expect(spineResponse.timeout).toBe("false")
  })

  test("health check network issues result returns failure", async () => {
    mock.onGet("/healthcheck").networkError()

    const spineResponse = await serviceHealthCheck("healthcheck", logger, httpsAgent, axiosInstance)

    expect(spineResponse.status).toBe("error")
    expect(spineResponse.responseCode).toBe(500)
    expect(spineResponse.links).toBe("healthcheck")
    expect(spineResponse.timeout).toBe("false")
  })
})
