import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import "jest"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"

const dummyContext = ContextExamples.helloworldContext
const mock = new MockAdapter(axios)
process.env.TargetSpineServer = "live"

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

describe("Unit test for app handler", function () {
  afterEach(() => {
    mock.reset()
  })

  it("verifies successful response", async () => {
    process.env.TargetSpineServer = "live"

    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify({statusCode: "0"}))
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
  })

  it("verifies error response when spine responds with bad statusCode", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "99"})
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    // TODO when https://github.com/NHSDigital/prescriptionsforpatients/pull/131 is merged
    // expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })

  it("verifies error response when spine responds with bad http statusCode", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(500, {statusCode: "0"})
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    // TODO when https://github.com/NHSDigital/prescriptionsforpatients/pull/131 is merged
    // expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })

  it("verifies error response when spine responds with network error", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    // TODO when https://github.com/NHSDigital/prescriptionsforpatients/pull/131 is merged
    // expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })

  it("verifies error response when no nhs number passed in", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })

  it("verifies error response when nhs login user cant be split", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {"nhsd-nhslogin-user": "1"}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })

  it("verifies error response when nhs login user has a string for NHS number", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {"nhsd-nhslogin-user": "P9:A"}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })

  it("verifies error response when nhs login user has a short NHS number", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {"nhsd-nhslogin-user": "P9:123"}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })

  it("verifies error response when nhs login user does not have P9 auth level", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {"nhsd-nhslogin-user": "P1:9912003071"}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })

  it("verifies error response when nhs login user has invalid check digit in NHS number", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    event.headers = {"nhsd-nhslogin-user": "P9:9912003072"}
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(400)
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
    expect(JSON.parse(result.body)).toEqual(responseStatus400)
  })
})

export {}
