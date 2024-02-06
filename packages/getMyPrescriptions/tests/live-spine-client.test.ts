import {LiveSpineClient} from "@nhsdigital/eps-spine-client"
import {extractNHSNumber} from "../src/extractNHSNumber"
import {jest, expect, describe} from "@jest/globals"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {APIGatewayProxyEventHeaders} from "aws-lambda"

const mock = new MockAdapter(axios)
process.env.TargetSpineServer = "spine"

describe("live spine client", () => {
  const logger = new Logger({serviceName: "spineClient"})

  afterEach(() => {
    mock.reset()
  })

  test("successful response when http response is status 200 and spine status does not exist", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})

    const spineClient = new LiveSpineClient(logger)
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const nhsNumber = extractNHSNumber(headers["nhsd-nhslogin-user"])
    logger.info(`nhsNumber: ${nhsNumber}`)
    const spineResponse = await spineClient.getPrescriptions(headers)

    expect(spineResponse.status).toBe(200)
    expect(spineResponse.data).toStrictEqual({resourceType: "Bundle"})
  })

  test("log response time on successful call", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
    const spineClient = new LiveSpineClient(logger)
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await spineClient.getPrescriptions(headers)

    expect(mockLoggerInfo).toHaveBeenCalledWith("spine request duration", {"spine_duration": expect.any(Number)})
  })

  test("log response time on unsuccessful call", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(401)
    const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")
    const spineClient = new LiveSpineClient(logger)
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers)).rejects.toThrow("Request failed with status code 401")

    expect(mockLoggerInfo).toHaveBeenCalledWith("spine request duration", {"spine_duration": expect.any(Number)})
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").networkError()

    const spineClient = new LiveSpineClient(logger)
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers)).rejects.toThrow("Network Error")
  })

  test("should throw error when timeout on http request", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").timeout()

    const spineClient = new LiveSpineClient(logger)
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers)).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
