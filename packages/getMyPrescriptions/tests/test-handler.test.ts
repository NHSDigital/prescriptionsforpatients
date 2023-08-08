import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"

const dummyContext = ContextExamples.helloworldContext
const mock = new MockAdapter(axios)

const exampleEvent = JSON.stringify({
  httpMethod: "get",
  body: "",
  headers: {"nhsd-nhslogin-user": "P9:9912003071"},
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: {},
  path: "/hello",
  pathParameters: {},
  queryStringParameters: {},
  requestContext: {
    accountId: "123456789012",
    apiId: "1234",
    authorizer: {},
    httpMethod: "get",
    identity: {
      accessKey: "",
      accountId: "",
      apiKey: "",
      apiKeyId: "",
      caller: "",
      clientCert: {
        clientCertPem: "",
        issuerDN: "",
        serialNumber: "",
        subjectDN: "",
        validity: {notAfter: "", notBefore: ""}
      },
      cognitoAuthenticationProvider: "",
      cognitoAuthenticationType: "",
      cognitoIdentityId: "",
      cognitoIdentityPoolId: "",
      principalOrgId: "",
      sourceIp: "",
      user: "",
      userAgent: "",
      userArn: ""
    },
    path: "/hello",
    protocol: "HTTP/1.1",
    requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
    requestTimeEpoch: 1428582896000,
    resourceId: "123456",
    resourcePath: "/hello",
    stage: "dev"
  },
  resource: "",
  stageVariables: {}
})

const responseStatus400 = {
  resourceType: "OperationOutcome",
  issue: [
    {
      code: "value",
      severity: "error",
      details: {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
            code: "INVALID_RESOURCE_ID",
            display: "Invalid resource ID"
          }
        ]
      }
    }
  ]
}

const responseStatus500 = {
  id: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
  resourceType: "OperationOutcome",
  issue: [
    {
      severity: "fatal",
      code: "exception",
      details: {
        coding: [
          {
            code: "SERVER_ERROR",
            display: "500: The Server has encountered an error processing the request.",
            system: "https://fhir.nhs.uk/CodeSystem/http-error-codes"
          }
        ]
      }
    }
  ]
}

type spineFailureTestData = {
  httpResponseCode: number
  spineStatusCode: string
  nhsdLoginUser: string | undefined
  errorResponse: object
  expectedHttpResponse: number
  scenarioDescription: string
}

describe("Unit test for app handler", function () {
  beforeEach(() => {
    process.env.TargetSpineServer = "live"
  })
  afterEach(() => {
    mock.reset()
  })

  it("verifies successful response", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify({statusCode: "0"}))
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
  })

  it.each<spineFailureTestData>([
    {
      httpResponseCode: 200,
      spineStatusCode: "99",
      nhsdLoginUser: "P9:9912003071",
      errorResponse: responseStatus500,
      expectedHttpResponse: 500,
      scenarioDescription: "failure response status code from spine"
    },
    {
      httpResponseCode: 500,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:9912003071",
      errorResponse: responseStatus500,
      expectedHttpResponse: 500,
      scenarioDescription: "failure http response code from spine"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: undefined,
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "no nhsdLoginUser passed in"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "9912003072",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "cant split nhsdLoginUser"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:A",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number in nhsdLoginUser contains a string"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:123",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number in nhsdLoginUser is too short"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P0:9912003071",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "auth level in nhsdLoginUser is not P9"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P0:9912003072",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number does not validate checksum"
    }
  ])(
    "return error when $scenarioDescription",
    async ({httpResponseCode, spineStatusCode, nhsdLoginUser, errorResponse, expectedHttpResponse}) => {
      mock.onGet("https://spine/mm/patientfacingprescriptions").reply(httpResponseCode, {statusCode: spineStatusCode})
      const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
      event.headers = {"nhsd-nhslogin-user": nhsdLoginUser}
      const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult
      expect(result.statusCode).toBe(expectedHttpResponse)
      expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
      expect(JSON.parse(result.body)).toEqual(errorResponse)
    }
  )

  it("return error when spine responds with network error", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })
})

export {}
