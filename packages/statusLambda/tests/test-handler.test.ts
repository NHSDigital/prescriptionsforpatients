import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/app"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"

const dummyContext = ContextExamples.helloworldContext

describe("Unit test for status check", function () {
  it("verifies pass response", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        returnType: "pass"
      }
    }
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(
      JSON.stringify({
        status: "pass",
        commitId: "Some version number",
        checks: [{}]
      })
    )
  })

  it("verifies warn response", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        returnType: "warn"
      }
    }
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(
      JSON.stringify({
        status: "warn",
        commitId: "Some version number",
        checks: [
          {
            message: "Warning about something non-critical"
          }
        ]
      })
    )
  })

  const errorResponseBody = {
    status: "error",
    commitId: "Some version number",
    checks: [
      {
        message: "There is an error somewhere"
      },
      {
        message: "And another one somewhere else"
      }
    ]
  }

  it("verifies error response", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        returnType: "error"
      }
    }
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify(errorResponseBody))
  })

  it("verifies default response", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: {
        returnType: "something else"
      }
    }
    const result: APIGatewayProxyResult = (await handler(
      event as APIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify(errorResponseBody))
  })
})
