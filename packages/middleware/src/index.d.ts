type ErrorHandlerResponse = MiddlewareObj<any, any, Error, any> | MiddlewareObj<any, any, Error, any>[]
declare function errorHandler(any): ErrorHandlerResponse
export default errorHandler
