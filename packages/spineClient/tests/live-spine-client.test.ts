import {LiveSpineClient} from "../src/live-spine-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {APIGatewayProxyEventHeaders} from "aws-lambda"

const mock = new MockAdapter(axios)
process.env.TargetSpineServer = "spine"
type spineSuccessTestData = [spineStatusCode: string]
type spineFailureTestData = [
  httpResponseCode: number,
  spineStatusCode: string,
  nhsdLoginUser: string | undefined,
  errorMessage: string
]

describe("live spine client", () => {
  const logger = new Logger({serviceName: "spineClient"})

  afterEach(() => {
    mock.reset()
  })

  test.each<spineSuccessTestData>([["0"], ["1"]])(
    "successful response when http response is status 200 and spine status is %i",
    async (spineStatusCode) => {
      mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, {statusCode: spineStatusCode})
      const spineClient = new LiveSpineClient()
      const headers: APIGatewayProxyEventHeaders = {
        "nhsd-nhslogin-user": "P9:9912003071"
      }
      const spineResponse = await spineClient.getPrescriptions(headers, logger)

      expect(spineResponse.status).toBe(200)
      expect(spineResponse.data).toStrictEqual({statusCode: spineStatusCode})
    }
  )

  test.each<spineFailureTestData>([
    [200, "99", "P9:9912003071", "Unsuccessful status code response from spine"],
    [500, "0", "P9:9912003071", "Request failed with status code 500"],
    [200, "0", undefined, "nhsloginUser not passed in"],
    [200, "0", "P9:A", "NHS Number failed preflight checks"],
    [200, "0", "P9:123", "NHS Number failed preflight checks"],
    [200, "0", "P0:9912003071", "Identity proofing level is not P9"],
    [200, "0", "P9:9912003072", "invalid check digit in NHS number"]
  ])(
    "throw error when http response is %i and spine status is %i and nhsd-login-user %j is passed in",
    async (httpResponseCode, spineStatusCode, nhsdLoginUser, errorMessage) => {
      mock.onGet("https://spine/mm/patientfacingprescriptions").reply(httpResponseCode, {statusCode: spineStatusCode})
      const spineClient = new LiveSpineClient()
      const headers: APIGatewayProxyEventHeaders = {
        "nhsd-nhslogin-user": nhsdLoginUser
      }
      await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow(errorMessage)
    }
  )

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://spine/mm/patientfacingprescriptions").networkError()

    const spineClient = new LiveSpineClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(spineClient.getPrescriptions(headers, logger)).rejects.toThrow("Network Error")
  })
})
