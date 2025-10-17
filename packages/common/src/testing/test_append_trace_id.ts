import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda"
import {Logger} from "@aws-lambda-powertools/logger"
import {expect, jest} from "@jest/globals"

type HandlerType = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
type TestType = () => Promise<void>

function test_append_trace_ids(handler: HandlerType, mockEvent: APIGatewayProxyEvent, dummyContext: Context): TestType {
  return async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    await handler(mockEvent, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
      "x-request-id": "test-request-id",
      "nhsd-request-id": "test-request-id",
      "x-correlation-id": "test-correlation-id",
      "apigw-request-id": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef"
    })
  }
}

export {test_append_trace_ids}
