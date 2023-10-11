module.exports = ({logger = console, level = "error"} = {}) => ({
  onError: async (handler) => {
    const error = handler.error ?? {}
    const requestId = handler.event.requestContext?.requestId ?? null
    const timeEpoch = handler.event.requestContext?.timeEpoch ?? null

    // if there are a `statusCode` and an `error` field
    // this is a valid http error object
    if (typeof logger[level] === "function") {
      logger[level](
        {
          error: (({name, message, stack, details, cause, status, statusCode, expose}) => ({
            name,
            message,
            stack,
            details,
            cause,
            status,
            statusCode,
            expose
          }))(error)
        },
        `${error.name ?? ""}: ${error.message ?? ""}`
      )
    }

    const responseBody = {
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
    }

    if (requestId !== null) {
      responseBody.id = requestId
    }
    if (timeEpoch !== null) {
      responseBody.meta = {
        lastUpdated: new Date(timeEpoch)
      }
    }

    handler.response = {
      statusCode: 500,
      body: JSON.stringify(responseBody),
      headers: {
        "Content-Type": "application/fhir+json",
        "Cache-Control": "no-cache"
      }
    }
  }
})
