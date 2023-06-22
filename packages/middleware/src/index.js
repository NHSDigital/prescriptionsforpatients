module.exports = ({logger = console, level = "error", filter = () => true} = {}) => ({
  onError: async (handler) => {
    const {error} = handler

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

    handler.response = {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "informational"
        }
      ]
    }
  }
})
