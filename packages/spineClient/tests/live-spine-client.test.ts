import {LiveSpineClient} from "../src/live-spine-client"
import "jest"
import * as moxios from "moxios"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {APIGatewayProxyEventHeaders} from "aws-lambda"

describe("live spine client", () => {
  const logger = new Logger({serviceName: "spineClient"})

  beforeEach(() => {
    moxios.install(axios)
  })

  afterEach(() => {
    moxios.uninstall(axios)
  })

  test("should work when successful response from spine", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 200,
        response: {statusCode: "00"}
      })
    })

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const spineResponse = await spineClient.getPrescriptions(headers, logger)

    expect(spineResponse.status).toBe(200)
    expect(spineResponse.data).toStrictEqual({statusCode: "00"})
  })

  test("should throw error when unsuccessful status response from spine", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 200,
        response: {statusCode: "01"}
      })
    })

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow(
      "Unsuccessful status code response from spine"
    )
  })

  test("should throw error when unsuccessful http response from spine", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 500
      })
    })

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("Request failed with status code 500")
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
