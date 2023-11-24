import {LiveServiceSearchClient} from "../src/live-serviceSearch-client"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"
import {APIGatewayProxyEventHeaders} from "aws-lambda"

const mock = new MockAdapter(axios)
process.env.TargetSpineServer = "serviceSearch"
type serviceSearchFailureTestData = {
  httpResponseCode: number
  serviceSearchStatusCode: string
  nhsdLoginUser: string | undefined
  errorMessage: string
  scenarioDescription: string
}

describe("live serviceSearch client", () => {
  const logger = new Logger({serviceName: "serviceSearchClient"})

  afterEach(() => {
    mock.reset()
  })

  test("successful response when http response is status 200 and serviceSearch status does not exist", async () => {
    mock.onGet("https://serviceSearch/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})
    const serviceSearchClient = new LiveServiceSearchClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    const serviceSearchResponse = await serviceSearchClient.getPrescriptions(headers, logger)

    expect(serviceSearchResponse.status).toBe(200)
    expect(serviceSearchResponse.data).toStrictEqual({resourceType: "Bundle"})
  })

  test.each<serviceSearchFailureTestData>([
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "99",
      nhsdLoginUser: "P9:9912003071",
      errorMessage: "Unsuccessful status code response from serviceSearch",
      scenarioDescription: "serviceSearch returns a non successful response status"
    },
    {
      httpResponseCode: 500,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: "P9:9912003071",
      errorMessage: "Request failed with status code 500",
      scenarioDescription: "serviceSearch returns an unsuccessful http status code"
    },
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: undefined,
      errorMessage: "nhsdloginUser not passed in",
      scenarioDescription: "no nhsd-login-user is passed in"
    },
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: "P9:A",
      errorMessage: "NHS Number failed preflight checks",
      scenarioDescription: "nhs number in nhsdLoginUser contains a string"
    },
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: "P9:123",
      errorMessage: "NHS Number failed preflight checks",
      scenarioDescription: "nhs number in nhsdLoginUser is too short"
    },
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: "P0:9912003071",
      errorMessage: "Identity proofing level is not P9",
      scenarioDescription: "Identity proofing in nhsdLoginUser is not P9"
    },
    {
      httpResponseCode: 200,
      serviceSearchStatusCode: "0",
      nhsdLoginUser: "P9:9912003072",
      errorMessage: "invalid check digit in NHS number",
      scenarioDescription: "nhs number does not validate checksum"
    }
  ])(
    "throw error when $scenarioDescription",
    async ({httpResponseCode, serviceSearchStatusCode, nhsdLoginUser, errorMessage}) => {
      mock.onGet("https://serviceSearch/mm/patientfacingprescriptions").reply(
        httpResponseCode, {statusCode: serviceSearchStatusCode}
      )
      const serviceSearchClient = new LiveServiceSearchClient()
      const headers: APIGatewayProxyEventHeaders = {
        "nhsd-nhslogin-user": nhsdLoginUser
      }
      await expect(serviceSearchClient.getPrescriptions(headers, logger)).rejects.toThrow(errorMessage)
    }
  )

  test("should throw error when unsuccessful http request", async () => {
    mock.onGet("https://serviceSearch/mm/patientfacingprescriptions").networkError()

    const serviceSearchClient = new LiveServiceSearchClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(serviceSearchClient.getPrescriptions(headers, logger)).rejects.toThrow("Network Error")
  })

  test("should throw error when timout on http request", async () => {
    mock.onGet("https://serviceSearch/mm/patientfacingprescriptions").timeout()

    const serviceSearchClient = new LiveServiceSearchClient()
    const headers: APIGatewayProxyEventHeaders = {
      "nhsd-nhslogin-user": "P9:9912003071"
    }
    await expect(serviceSearchClient.getPrescriptions(headers, logger)).rejects.toThrow("timeout of 45000ms exceeded")
  })
})
