import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {
  DEFAULT_HANDLER_PARAMS,
  handler,
  newHandler,
  GetMyPrescriptionsEvent,
  apiGatewayHandler,
  apiGatewayEventHandler
} from "../src/getMyPrescriptions"
import {Logger} from "@aws-lambda-powertools/logger"
import axios from "axios"
import MockAdapter from "axios-mock-adapter"
import {
  expect,
  describe,
  it,
  jest
} from "@jest/globals"

import {
  mockAPIGatewayProxyEvent,
  mockAPIResponseBody,
  mockInteractionResponseBody,
  mockPharmacy2uResponse,
  mockPharmicaResponse,
  helloworldContext,
  mockStateMachineInputEvent
} from "@prescriptionsforpatients_common/testing"

import {HEADERS, StateMachineFunctionResponseBody, TIMEOUT_RESPONSE} from "../src/responses"
import "./toMatchJsonLogMessage"
import {EXPECTED_TRACE_IDS} from "./utils"

const dummyContext = helloworldContext
const mock = new MockAdapter(axios)

const exampleApiGatewayEvent = JSON.stringify(mockAPIGatewayProxyEvent)
const exampleStateMachineEvent = JSON.stringify(mockStateMachineInputEvent)
const exampleInteractionResponse = JSON.stringify(mockInteractionResponseBody)

const pharmacy2uResponse = JSON.stringify(mockPharmacy2uResponse)
const pharmicaResponse = JSON.stringify(mockPharmicaResponse)

const responseStatus400 = {
  resourceType: "OperationOutcome",
  issue: [
    {
      code: "value",
      severity: "error",
      details: {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
            code: "INVALID_RESOURCE_ID",
            display: "Invalid resource ID"
          }
        ]
      }
    }
  ]
}

const responseStatus500 = {
  id: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
  resourceType: "OperationOutcome",
  issue: [
    {
      severity: "fatal",
      code: "exception",
      details: {
        coding: [
          {
            code: "SERVER_ERROR",
            display: "500: The Server has encountered an error processing the request.",
            system: "https://fhir.nhs.uk/CodeSystem/http-error-codes"
          }
        ]
      }
    }
  ]
}

const responseNotConfCertStatus500 = {
  resourceType: "OperationOutcome",
  issue: [
    {
      code: "security",
      severity: "fatal",
      details: {
        coding: [
          {
            system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
            code: "SERVER_ERROR",
            display: "500: The Server has encountered an error processing the request."
          }
        ]
      },
      diagnostics: "Spine certificate is not configured"
    }
  ]
}

type spineFailureTestData = {
  httpResponseCode: number
  spineStatusCode: string
  nhsdLoginUser: string | undefined
  errorResponse: object
  expectedHttpResponse: number
  scenarioDescription: string
}

describe("Unit test for app handler", function () {
  const ENV = process.env

  beforeEach(() => {
    process.env = {...ENV}
    process.env.TargetSpineServer = "live"
    jest.useFakeTimers()
  })
  afterEach(() => {
    process.env = {...ENV}
    jest.clearAllTimers()
    mock.reset()
  })

  it("verifies successful response using state machine handler", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})

    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    const result: APIGatewayProxyResult = (await handler(event, dummyContext))
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toEqual(200)
    expect(resultBody.fhir).toEqual({resourceType: "Bundle", id: "test-request-id"})
    expect(resultBody.statusUpdateData).toBeUndefined()
    expect(resultBody.traceIDs).toEqual(EXPECTED_TRACE_IDS)
    expect(result.headers).toEqual(HEADERS)
  })

  it("verifies successful response using lambda handler", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(JSON.stringify({resourceType: "Bundle", id: "test-request-id"}))
    expect(result.headers).toEqual(HEADERS)
  })

  it.each<spineFailureTestData>([
    {
      httpResponseCode: 200,
      spineStatusCode: "99",
      nhsdLoginUser: "P9:9912003071",
      errorResponse: responseStatus500,
      expectedHttpResponse: 500,
      scenarioDescription: "failure response status code from spine"
    },
    {
      httpResponseCode: 500,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:9912003071",
      errorResponse: responseStatus500,
      expectedHttpResponse: 500,
      scenarioDescription: "failure http response code from spine"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: undefined,
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "no nhsdLoginUser passed in"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "9912003072",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "cant split nhsdLoginUser"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:A",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number in nhsdLoginUser contains a string"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P9:123",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number in nhsdLoginUser is too short"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P0:9912003071",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "auth level in nhsdLoginUser is not P9"
    },
    {
      httpResponseCode: 200,
      spineStatusCode: "0",
      nhsdLoginUser: "P0:9912003072",
      errorResponse: responseStatus400,
      expectedHttpResponse: 400,
      scenarioDescription: "nhs number does not validate checksum"
    }
  ])(
    "return error when $scenarioDescription",
    async ({httpResponseCode, spineStatusCode, nhsdLoginUser, errorResponse, expectedHttpResponse}) => {
      mock.onGet("https://live/mm/patientfacingprescriptions").reply(httpResponseCode, {statusCode: spineStatusCode})
      const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
      event.headers = {"nhsd-nhslogin-user": nhsdLoginUser}
      const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))
      expect(result.statusCode).toBe(expectedHttpResponse)
      expect(result.headers).toEqual(HEADERS)
      expect(JSON.parse(result.body)).toEqual(errorResponse)
    }
  )

  it("return error when spine responds with network error", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })

  it("appends trace id's to the logger", async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    await apiGatewayHandler(event, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "nhsd-correlation-id": "test-request-id.test-correlation-id.rrt-5789322914740101037-b-aet2-20145-482635-2",
      "x-request-id": "test-request-id",
      "nhsd-request-id": "test-request-id",
      "x-correlation-id": "test-correlation-id",
      "apigw-request-id": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef"
    })
  })

  it("return error when spine does not respond in time", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").timeout()
    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual(responseStatus500)
  })

  it("return error when the certificate is not configured", async () => {
    process.env.SpinePublicCertificate = "ChangeMe"
    process.env.SpinePrivateKey = "ChangeMe"
    process.env.SpineCAChain = "ChangeMe"

    mock.onGet("https://live/mm/patientfacingprescriptions").reply(500, {resourceType: "Bundle"})
    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = await apiGatewayHandler(event, dummyContext)

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual(responseNotConfCertStatus500)
  })

  it("times-out if spine call takes too long", async () => {
    const mockErrorLogger = jest.spyOn(Logger.prototype, "error")
    const delayedResponse: Promise<Array<unknown>> = new Promise((resolve) => setTimeout(() => resolve([]), 15_000))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mock.onGet("https://live/mm/patientfacingprescriptions").reply((_config) => delayedResponse)

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const eventHandler: Promise<APIGatewayProxyResult> = apiGatewayHandler(event, dummyContext)

    await jest.advanceTimersByTimeAsync(11_000)

    const result = await eventHandler
    expect(result.statusCode).toBe(408)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual(JSON.parse(TIMEOUT_RESPONSE.body))

    // Assert error level log was produced
    expect(mockErrorLogger).toHaveBeenCalledWith("Call to Spine has timed out. Returning error response.")
  })

  it("times-out if lambda handler takes too long", async () => {
    const mockErrorLogger = jest.spyOn(Logger.prototype, "error")

    // delaying spine response to trigger lambda timeout
    const handlerParams = {...DEFAULT_HANDLER_PARAMS, lambdaTimeoutMs: 1_000}
    const handler = newHandler({
      handlerFunction: apiGatewayEventHandler,
      params: handlerParams,
      middleware: []
    })
    const delayedResponse: Promise<Array<unknown>> = new Promise((resolve) => setTimeout(() => resolve([]), 5_000))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mock.onGet("https://live/mm/patientfacingprescriptions").reply((_config) => delayedResponse)

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const eventHandler: Promise<APIGatewayProxyResult> = handler(event, dummyContext)

    await jest.advanceTimersByTimeAsync(2_000)

    const result = await eventHandler
    expect(result.statusCode).toBe(408)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual(JSON.parse(TIMEOUT_RESPONSE.body))

    // Assert error level log was produced
    expect(mockErrorLogger).toHaveBeenCalledWith("Lambda handler has timed out. Returning error response.")
  })
})

describe("Unit tests for app handler including service search", function () {
  const queryParams = {
    "api-version": 2,
    "searchFields": "ODSCode",
    "$filter": "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
    "$select": "URL,OrganisationSubType",
    "$top": 1
  }

  beforeEach(() => {
    mock.reset()
    mock.resetHistory()
    jest.useFakeTimers()
    process.env.TargetSpineServer = "spine"
    process.env.TargetServiceSearchServer = "service-search"
    process.env.SpinePublicCertificate = "public-certificate"
    process.env.SpinePrivateKey = "private-key"
    process.env.SpineCAChain = "ca-chain"
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it("local cache is used to reduce calls to service search", async () => {
    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)

    mock.onGet(
      "https://service-search/service-search", {params: {...queryParams, search: "flm49"}}
    ).reply(200, JSON.parse(pharmacy2uResponse))

    mock.onGet(
      "https://service-search/service-search", {params: {...queryParams, search: "few08"}}
    ).reply(200, JSON.parse(pharmicaResponse))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))
    const resultA: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))
    const resultB: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    for (const result of [resultA, resultB]) {
      expect(result.statusCode).toEqual(200)
      expect(JSON.parse(result.body)).toEqual(mockAPIResponseBody)
      expect(result.headers).toEqual(HEADERS)
    }

    expect(mock.history.get.length).toEqual(4)
  })

  it("integration test adding urls to performer organisations", async () => {
    const interactionResponse = JSON.parse(exampleInteractionResponse)

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, interactionResponse)

    mock.onGet(
      "https://service-search/service-search", {params: {...queryParams, search: "flm49"}}
    ).reply(200, JSON.parse(pharmacy2uResponse))

    mock.onGet(
      "https://service-search/service-search", {params: {...queryParams, search: "few08"}}
    ).reply(200, JSON.parse(pharmicaResponse))

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    expect(result.statusCode).toEqual(200)
    expect(result.body).toEqual(
      JSON.stringify(mockAPIResponseBody)
    )
    expect(result.headers).toEqual(HEADERS)
  })

  it("return un-enhanced data if service search call takes too long", async () => {
    const exampleResponse = {resourceType: "Bundle"}
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, exampleResponse)

    const delayedResponse: Promise<Array<unknown>> = new Promise((resolve) => setTimeout(() => resolve([]), 15_000))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mock.onGet("https://service-search/service-search").reply((_config) => delayedResponse)

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const eventHandler: Promise<APIGatewayProxyResult> = apiGatewayHandler(event, dummyContext)

    await jest.advanceTimersByTimeAsync(8_000)

    const result = await eventHandler
    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual(HEADERS)
    expect(JSON.parse(result.body)).toEqual({...exampleResponse, id: "test-request-id"})
  })
})

it("logs the correct apigw-request-id on multiple calls", async () => {
  const mockLoggerInfo = jest.spyOn(Logger.prototype, "info")

  mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

  const event_one: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
  const event_two: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
  event_two.requestContext.requestId = "d6af9ac6-7b61-11e6-9a41-93e8deadbeef"
  await apiGatewayHandler(event_one, dummyContext)
  await apiGatewayHandler(event_two, dummyContext)

  const expectedIds = ["c6af9ac6-7b61-11e6-9a41-93e8deadbeef", "d6af9ac6-7b61-11e6-9a41-93e8deadbeef"].reverse()

  for (const call of mockLoggerInfo.mock.calls) {
    // Consider only request logs
    if(typeof call[0] !== "object") {
      continue
    }

    const event = call[0].event as Record<string, Record<string, string>>
    const headers = event["headers"]
    const requestContext = event["requestContext"]

    const expectedId = expectedIds.pop()

    expect(headers["apigw-request-id"]).toEqual(expectedId)
    expect(requestContext["requestId"]).toEqual(expectedId)
  }
})

export {}
