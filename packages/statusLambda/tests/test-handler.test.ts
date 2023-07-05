import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app.js"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"

const dummyContext = ContextExamples.helloworldContext

describe("Unit test for status check", function () {
  it("returns commit id from environment", async () => {
    process.env.COMMIT_ID = "test_commit_id"

    const event: Partial<APIGatewayProxyEvent> = {}
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      commitId: "test_commit_id"
    })
  })

  it("returns version number from environment", async () => {
    process.env.VERSION_NUMBER = "test_version_number"

    const event: Partial<APIGatewayProxyEvent> = {}
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      versionNumber: "test_version_number"
    })
  })
})
