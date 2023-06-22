module.exports = ({logger = console, level = "error", filter = () => true} = {}) => ({
  onError: async (handler) => {
    const error = handler.error ?? {}
    const requestId = handler.event.requestContext?.requestId ?? null
    const requestTimeEpoch = handler.event.requestContext?.requestTimeEpoch ?? null

    // if there are a `statusCode` and an `error` field
    // this is a valid http error object
    if (filter(error) && typeof logger[level] === "function") {
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

    const response = {
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

    if(requestId!==null){
      response.id = requestId
    }
    if(requestTimeEpoch!==null){
      response.meta = {
        lastUpdated: requestTimeEpoch
      }
    }

    handler.response = response
  }
})
