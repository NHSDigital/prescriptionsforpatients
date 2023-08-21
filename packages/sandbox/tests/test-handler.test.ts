import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import {Logger} from "@aws-lambda-powertools/logger"
import successData from "../examples/GetMyPrescriptions/Bundle/success.json"
import {mockAPIGatewayProxyEvent, test_mime_type} from "@prescriptionsforpatients_common/testing"

const dummyContext = ContextExamples.helloworldContext
const mockEvent: APIGatewayProxyEvent = mockAPIGatewayProxyEvent

describe("Unit test for app handler", function () {
  it("verifies successful response with no params", async () => {
    const result: APIGatewayProxyResult = await handler(mockEvent, dummyContext)

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify(successData))
  })
  it("returns a response with the correct MIME type", test_mime_type(handler, mockEvent, dummyContext))
  it("appends trace id's to the logger", async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    await handler(mockEvent, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
      "x-request-id": "test-request-id",
      "nhsd-request-id": "test-request-id",
      "x-correlation-id": "test-correlation-id",
      "apigw-request-id": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef"
    })
  })
})
