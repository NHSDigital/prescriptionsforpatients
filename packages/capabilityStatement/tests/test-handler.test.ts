import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/capabilityStatement"
import {expect, describe, it} from "@jest/globals"
import {helloworldContext} from "@prescriptionsforpatients_common/testing"
import capabilityStatement from "../examples/CapabilityStatement/apim-medicines-prescriptionsforpatients.json"
import {mockAPIGatewayProxyEvent, test_append_trace_ids, test_mime_type} from "@prescriptionsforpatients_common/testing"

const dummyContext = helloworldContext
const mockEvent: APIGatewayProxyEvent = mockAPIGatewayProxyEvent

describe("Unit test for app handler", function () {
  it("verifies successful response with no params", async () => {
    const result: APIGatewayProxyResult = await handler(mockEvent, dummyContext)

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify(capabilityStatement))
  })
  it("returns a response with the correct MIME type", test_mime_type(handler, mockEvent, dummyContext))

  it("appends trace id's to the logger", test_append_trace_ids(handler, mockEvent, dummyContext))
})
