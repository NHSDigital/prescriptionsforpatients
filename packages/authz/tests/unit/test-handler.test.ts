import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../../app"
import {expect, describe, it} from "@jest/globals"
import {Context} from "aws-lambda"

const sampleContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: "",
  functionVersion: "",
  invokedFunctionArn: "",
  memoryLimitInMB: "234",
  awsRequestId: "",
  logGroupName: "",
  logStreamName: "",
  getRemainingTimeInMillis: (): number => 1,
  /* eslint-disable-next-line  @typescript-eslint/no-empty-function */
  done: () => {},
  /* eslint-disable-next-line  @typescript-eslint/no-empty-function */
  fail: () => {},
  /* eslint-disable-next-line  @typescript-eslint/no-empty-function */
  succeed: () => {}
}

describe("Unit test for app handler", function () {
  it("verifies successful response", async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: "get",
      body: "",
      headers: {},
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
    const result: APIGatewayProxyResult = (await handler(event, sampleContext)) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(
      JSON.stringify({
        message: "hello world from authz lambda"
      })
    )
  })
})
