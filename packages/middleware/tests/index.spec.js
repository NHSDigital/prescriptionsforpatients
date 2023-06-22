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
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "error",
        code: "informational",
        details: [],
        expression: ""
      }
    ]
  })
})

// test("Middleware doesn't log 404 errors - they happen a lot", async () => {
//     const mockLogger = {
//         error: jest.fn(() => {}),
//     };

//     const handler = middy(() => {
//         throw new createError.NotFound('File not found');
//     });

//     handler.use(middleware({ logger: mockLogger, filter: (err) => err.statusCode >= 500 }));

//     const response = await handler({}, {});
//     const { statusCode, message, stack } = JSON.parse(response.body);

//     expect(statusCode).toBe(404);
//     expect(message).toBe('File not found');
//     expect(stack).toBeUndefined();

//     expect(mockLogger.error).toHaveBeenCalledTimes(0);
// });

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
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "error",
        code: "informational",
        details: [],
        expression: ""
      }
    ]
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

// test('Keep data already present in response', async () => {
//     const handler = middy(async () => {
//         throw error;
//     });

//     handler.use(middleware({ logger: false }));

//     // eslint-disable-next-line no-shadow
//     handler.onError(async (handler) => {
//         // eslint-disable-next-line no-param-reassign
//         handler.response = {
//             headers: {
//                 someHeader: 'someValue',
//             },
//         };
//     });

//     await expect(handler({}, {})).resolves.toMatchObject({
//         body: JSON.stringify({ statusCode: 404, message: 'File not found' }),
//         statusCode: 404,
//         headers: { someHeader: 'someValue' },
//     });
// });
