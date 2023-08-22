import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda"

type HandlerType = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
type TestType = () => Promise<void>

function test_mime_type(handler: HandlerType, mockEvent: APIGatewayProxyEvent, dummyContext: Context): TestType {
  return async () => {
    const result: APIGatewayProxyResult = await handler(mockEvent, dummyContext)

    expect(result.headers).toEqual({"Content-Type": "application/fhir+json", "Cache-Control": "no-cache"})
  }
}

export {test_mime_type}
