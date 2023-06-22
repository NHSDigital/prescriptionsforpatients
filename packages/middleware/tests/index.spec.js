const middy = require("@middy/core")
const createError = require("http-errors")
const middleware = require("../src/index")

const error = new createError.NotFound("File not found")

test("Middleware returns valid FHIR with logging disabled", async () => {
  const handler = middy(() => {
    throw error
  })

  handler.use(middleware({logger: false}))

  await expect(handler({}, {})).resolves.toMatchObject({
    statusCode: 500,
    body: JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "fatal",
          code: "exception",
          details: {
            coding: [
              {
                system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
                code: "SERVER_ERROR",
                display: "500: The Server has encountered an error processing the request."
              }
            ]
          }
        }
      ]
    })
  })
})

test("Middleware logs all error details and returns valid FHIR", async () => {
  const mockLogger = {
    error: jest.fn(() => {})
  }

  const handler = middy(() => {
    throw new createError.ServiceUnavailable("Service not available")
  })

  handler.use(middleware({logger: mockLogger, exposeStackTrace: true}))

  const response = await handler({}, {})

  expect(response).toMatchObject({
    statusCode: 500,
    body: JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "fatal",
          code: "exception",
          details: {
            coding: [
              {
                system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
                code: "SERVER_ERROR",
                display: "500: The Server has encountered an error processing the request."
              }
            ]
          }
        }
      ]
    })
  })

  expect(mockLogger.error).toHaveBeenCalledTimes(1)

  const [errorObject, errorMessage] = mockLogger.error.mock.calls[mockLogger.error.mock.calls.length - 1]
  expect(errorMessage).toBe("ServiceUnavailableError: Service not available")
  expect(errorObject.error.name).toBe("ServiceUnavailableError")
  expect(errorObject.error.message).toBe("Service not available")
  expect(errorObject.error.status).toBe(503)
  expect(errorObject.error.statusCode).toBe(503)
  expect(errorObject.error.expose).toBe(false)
  expect(errorObject.error.stack).not.toBeNull()
})
