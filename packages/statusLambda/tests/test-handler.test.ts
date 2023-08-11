import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import {Logger} from "@aws-lambda-powertools/logger"

const dummyContext = ContextExamples.helloworldContext
const mockEvent: APIGatewayProxyEvent = {
  httpMethod: "get",
  body: "",
  headers: {
    "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
    "x-request-id": "test-request-id",
    "nhsd-request-id": "test-request-id",
    "x-correlation-id": "test-correlation-id"
  },
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
}

describe("Unit test for status check", function () {
  it("returns commit id from environment", async () => {
    process.env.COMMIT_ID = "test_commit_id"
    process.env.TargetSpineServer = "sandbox"

    const result: APIGatewayProxyResult = (await handler(mockEvent, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      commitId: "test_commit_id"
    })
  })

  it("returns version number from environment", async () => {
    process.env.VERSION_NUMBER = "test_version_number"
    process.env.TargetSpineServer = "sandbox"

    const result: APIGatewayProxyResult = (await handler(mockEvent, dummyContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      versionNumber: "test_version_number"
    })
  })
  it("appends trace id's to the logger", async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    await handler(mockEvent, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
      "x-request-id": "test-request-id",
      "nhsd-request-id": "test-request-id",
      "x-correlation-id": "test-correlation-id",
      "apigw-request-id": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef"
    })
  })
})
