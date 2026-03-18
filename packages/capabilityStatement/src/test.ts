import middy from "@middy/core"
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware"
import {Logger} from "@aws-lambda-powertools/logger"

export const logger = new Logger({serviceName: "test_service"})

const lambdaHandler = async (): Promise<unknown> => {
  return {foo: "bar"}
}

const foo = injectLambdaContext(logger, {clearState: true})

export const handler = middy(lambdaHandler)
  .use(foo)
