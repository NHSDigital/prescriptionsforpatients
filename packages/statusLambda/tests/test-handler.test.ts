import {APIGatewayProxyResult} from "aws-lambda"
import {handler} from "../src/statusLambda"
import {expect, describe, it} from "@jest/globals"
import {ContextExamples} from "@aws-lambda-powertools/commons"
import {Logger} from "@aws-lambda-powertools/logger"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {mockAPIGatewayProxyEvent} from "@prescriptionsforpatients_common/testing"

const mock = new MockAdapter(axios)

const dummyContext = ContextExamples.helloworldContext

describe("Unit test for status check", function () {
  afterEach(() => {
    mock.reset()
  })

  it("returns commit id from environment", async () => {
    process.env.COMMIT_ID = "test_commit_id"
    process.env.TargetSpineServer = "sandbox"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      commitId: "test_commit_id"
    })
  })

  it("returns version number from environment", async () => {
    process.env.VERSION_NUMBER = "test_version_number"
    process.env.TargetSpineServer = "sandbox"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    expect(JSON.parse(result.body)).toMatchObject({
      versionNumber: "test_version_number"
    })
  })

  it("appends trace id's to the logger", async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    await handler(mockAPIGatewayProxyEvent, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
      "x-request-id": "test-request-id",
      "nhsd-request-id": "test-request-id",
      "x-correlation-id": "test-correlation-id",
      "apigw-request-id": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef"
    })
  })

  it("returns no-cache Cache-Control header", async () => {
    process.env.COMMIT_ID = "test_commit_id"
    process.env.TargetSpineServer = "sandbox"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    const headers = result.headers

    expect(headers).toMatchObject({
      "Cache-Control": "no-cache"
    })
  })

  it("returns success when spine check succeeds", async () => {
    mock.onGet("https://live/healthcheck").reply(200, {})
    process.env.TargetSpineServer = "live"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    const result_body = JSON.parse(result.body)
    expect(result_body.status).toEqual("pass")
    expect(result_body.spineStatus.status).toEqual("pass")
    expect(result_body.spineStatus.timeout).toEqual("false")
    expect(result_body.spineStatus.responseCode).toEqual(200)
  })

  it("returns failure when spine check fails", async () => {
    mock.onGet("https://live/healthcheck").reply(500, {})
    process.env.TargetSpineServer = "live"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    const result_body = JSON.parse(result.body)
    expect(result_body.status).toEqual("error")
    expect(result_body.spineStatus.status).toEqual("error")
    expect(result_body.spineStatus.timeout).toEqual("false")
    expect(result_body.spineStatus.responseCode).toEqual(500)
  })

  it("returns failure when spine check has network error", async () => {
    mock.onGet("https://live/healthcheck").networkError()
    process.env.TargetSpineServer = "live"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    const result_body = JSON.parse(result.body)
    expect(result_body.status).toEqual("error")
    expect(result_body.spineStatus.status).toEqual("error")
    expect(result_body.spineStatus.timeout).toEqual("false")
    expect(result_body.spineStatus.responseCode).toEqual(500)
  })

  it("returns failure when spine check has timeout", async () => {
    mock.onGet("https://live/healthcheck").timeout()
    process.env.TargetSpineServer = "live"

    const result: APIGatewayProxyResult = (await handler(
      mockAPIGatewayProxyEvent,
      dummyContext
    )) as APIGatewayProxyResult

    expect(result.statusCode).toEqual(200)
    const result_body = JSON.parse(result.body)
    expect(result_body.status).toEqual("error")
    expect(result_body.spineStatus.status).toEqual("error")
    expect(result_body.spineStatus.timeout).toEqual("true")
    expect(result_body.spineStatus.responseCode).toEqual(500)
  })
})
