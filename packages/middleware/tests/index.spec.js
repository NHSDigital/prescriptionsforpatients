const middy = require("@middy/core")
const middleware = require("../src/index")

const mockEvent = {
  httpMethod: "get",
  body: "",
  headers: {},
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: {},
  path: "/hello",
  pathParameters: {},
  queryStringParameters: {
    returnType: "error"
  },
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
    timeEpoch: 1428582896001,
    resourceId: "123456",
    resourcePath: "/hello",
    stage: "dev"
  },
  resource: "",
  stageVariables: {}
}

test("Middleware logs all error details", async () => {
  const mockLogger = {
    error: jest.fn(() => {})
  }

  const handler = middy(() => {
    throw new Error("error running lambda")
  })

  handler.use(middleware({logger: mockLogger, exposeStackTrace: true}))

  await handler({}, {})

  expect(mockLogger.error).toHaveBeenCalledTimes(1)

  const [errorObject, errorMessage] = mockLogger.error.mock.calls[mockLogger.error.mock.calls.length - 1]
  expect(errorMessage).toBe("Error: error running lambda")
  expect(errorObject.error.name).toBe("Error")
  expect(errorObject.error.message).toBe("error running lambda")
  expect(errorObject.error.stack).not.toBeNull()
})

test("Middleware returns details as valid fhir from lambda event", async () => {
  const mockLogger = {
    error: jest.fn(() => {})
  }

  const handler = middy(() => {
    throw new Error("error running lambda")
  })

  handler.use(middleware({logger: mockLogger, exposeStackTrace: true}))

  const response = await handler(mockEvent, {})
  expect(response.statusCode).toBe(500)
  expect(JSON.parse(response.body)).toMatchObject({
    id: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
    meta: {
      lastUpdated: 1428582896001
    },
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

test("Returns a response with the correct MIME type", async () => {
  const mockLogger = {
    error: jest.fn(() => {})
  }
  const handler = middy(() => {
    throw new Error("error running lambda")
  })
  handler.use(middleware({logger: mockLogger, exposeStackTrace: true}))

  const response = await handler(mockEvent, {})

  expect(response.headers).toEqual({"Content-Type": "application/fhir+json"})
})
