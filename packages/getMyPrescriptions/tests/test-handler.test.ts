import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import "jest"
import * as moxios from "moxios"
import axios from "axios"

const dummyContext = ContextExamples.helloworldContext
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

describe("Unit test for app handler", function () {
  beforeEach(() => {
    moxios.install(axios)
  })

  afterEach(() => {
    moxios.uninstall(axios)
  })

  it("verifies successful response", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 200,
        response: {statusCode: "0"}
      })
    })

    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify({statusCode: "0"}))
    expect(result.headers).toEqual({"Content-Type": "application/fhir+json"})
  })

  it("verifies error response when spine responds with bad statusCode", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 200,
        response: {statusCode: "50"}
      })
    })
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
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
    })
  })

  it("verifies error response when spine responds with bad http statusCode", async () => {
    moxios.wait(() => {
      const request = moxios.requests.mostRecent()
      request.respondWith({
        status: 500
      })
    })
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)
    const result: APIGatewayProxyResult = (await handler(event, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
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
    })
  })
})

export {}
