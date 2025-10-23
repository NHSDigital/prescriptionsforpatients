import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/sandbox"
import {expect, describe, it} from "@jest/globals"
import successData from "../examples/GetMyPrescriptions/Bundle/success.json"
import {
  mockAPIGatewayProxyEvent,
  helloworldContext,
  test_append_trace_ids,
  test_mime_type
} from "@common/utilities"

const dummyContext = helloworldContext
const mockEvent: APIGatewayProxyEvent = mockAPIGatewayProxyEvent

describe("Unit test for app handler", function () {
  it("verifies successful response with no params", async () => {
    const result: APIGatewayProxyResult = await handler(mockEvent, dummyContext)

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify(successData))
  })
  it("returns a response with the correct MIME type", test_mime_type(handler, mockEvent, dummyContext))

  it("appends trace id's to the logger", test_append_trace_ids(handler, mockEvent, dummyContext))
})
