import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
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

  it("returns pull request number from environment", async () => {
    delete process.env.VERSION_NUMBER
    process.env.PR_NUMBER = "test_pr_number"

    const event: Partial<APIGatewayProxyEvent> = {}
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      versionNumber: "PR-test_pr_number"
    })
  })

  it("returns version number from environment if both version number and pr number are set", async () => {
    process.env.VERSION_NUMBER = "test_version_number"
    process.env.PR_NUMBER = "test_pr_number"

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
