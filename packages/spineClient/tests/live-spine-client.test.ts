import {LiveSpineClient} from "../src/live-spine-client"
import "jest"
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

  test("should work when successful response 0 from spine", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const spineResponse = await spineClient.getPrescriptions(headers, logger)

    expect(spineResponse.status).toBe(200)
    expect(spineResponse.data).toStrictEqual({statusCode: "0"})
  })

  test("should work when successful response 1 from spine", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {statusCode: "1"})
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const spineResponse = await spineClient.getPrescriptions(headers, logger)

    expect(spineResponse.status).toBe(200)
    expect(spineResponse.data).toStrictEqual({statusCode: "1"})
  })

  test("should throw error when unsuccessful statusCode response from spine", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {statusCode: "99"})

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow(
      "Unsuccessful status code response from spine"
    )
  })

  test("should throw error when unsuccessful http response from spine", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(500, {statusCode: "0"})

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("Request failed with status code 500")
  })

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").networkError()

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("Network Error")
  })

  test("should throw error when no nhsd-nhslogin-user header is passed", async () => {
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {}
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("nhsloginUser not passed in")
  })

  test("should throw error when nhsd-nhslogin-user header has a string for nhs number", async () => {
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:A"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("NHS Number failed preflight checks")
  })

  test("should throw error when nhsd-nhslogin-user header has short nhs number", async () => {
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:123"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("NHS Number failed preflight checks")
  })

  test("should throw error when nhsd-nhslogin-user header has does not have P9 auth level", async () => {
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P1:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("Identity proofing level is not P9")
  })

  test("should throw error when nhsd-nhslogin-user header has nhs number with invalid check digit", async () => {
    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003072"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("invalid check digit in NHS number")
  })
})
