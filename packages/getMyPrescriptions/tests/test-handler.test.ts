/* eslint-disable max-len */

import {
  expect,
  describe,
  it,
  jest
} from "@jest/globals"
import "./toMatchJsonLogMessage"
import {helloworldContext} from "@prescriptionsforpatients_common/testing"
import {Logger} from "@aws-lambda-powertools/logger"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {OperationOutcome} from "fhir/r4"
import {
  mockAPIGatewayProxyEvent,
  mockStateMachineInputEvent,
  mockAPIResponseBody,
  mockInteractionResponseBody,
  mockPharmacy2uResponse,
  mockPharmicaResponse
} from "@prescriptionsforpatients_common/testing"
import {
  HEADERS,
  StateMachineFunctionResponseBody,
  TIMEOUT_RESPONSE,
  stateMachineLambdaResponse
} from "../src/responses"
import {SERVICE_SEARCH_PARAMS, mockInternalDependency} from "./utils"

import * as statusUpdate from "../src/statusUpdate"

import {GetMyPrescriptionsEvent, apiGatewayHandler} from "../src/getMyPrescriptions"
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
mockInternalDependency("../src/statusUpdate", statusUpdate, "buildStatusUpdateData")
const {handler} = await import("../src/getMyPrescriptions")

const dummyContext = helloworldContext
const mock = new MockAdapter(axios)

const exampleStateMachineEvent = JSON.stringify(mockStateMachineInputEvent)
const exampleApiGatewayEvent = JSON.stringify(mockAPIGatewayProxyEvent)
const exampleInteractionResponse = JSON.stringify(mockInteractionResponseBody)

const pharmacy2uResponse = JSON.stringify(mockPharmacy2uResponse)
const pharmicaResponse = JSON.stringify(mockPharmicaResponse)

const APIGW_REQUEST_ID = "test-apigw-request-id"

const responseStatus400: OperationOutcome = {
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

const responseStatus500: OperationOutcome = {
  id: APIGW_REQUEST_ID,
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

const responseNotConfCertStatus500: OperationOutcome = {
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
    expect(resultBody.fhir).not.toEqual({resourceType: "Bundle", id: "test-x-request-id"})
    expect(result.headers).toEqual(HEADERS)
  })

  it("verifies successful response using lambda handler", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {resourceType: "Bundle"})

    const event: APIGatewayProxyEvent = JSON.parse(exampleApiGatewayEvent)
    const result: APIGatewayProxyResult = (await apiGatewayHandler(event, dummyContext))

    expect(result.statusCode).toEqual(200)
    expect(result.body).not.toEqual(JSON.stringify({resourceType: "Bundle", id: "test-x-request-id"}))
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
      const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
      event.headers = {"nhsd-nhslogin-user": nhsdLoginUser, "apigw-request-id": APIGW_REQUEST_ID}

      const result: APIGatewayProxyResult = (await handler(event, dummyContext))
      const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

      expect(result.statusCode).toBe(expectedHttpResponse)
      expect(result.headers).toEqual(HEADERS)
      expect(resultBody.fhir).toEqual(errorResponse)
    }
  )

  it("return error when spine responds with network error", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").networkError()
    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    const result: APIGatewayProxyResult = (await handler(event, dummyContext))
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(resultBody.fhir).toEqual(responseStatus500)
  })

  it("appends trace id's to the logger", async () => {
    const mockAppendKeys = jest.spyOn(Logger.prototype, "appendKeys")

    mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
    await handler(event, dummyContext)

    expect(mockAppendKeys).toHaveBeenCalledWith({
      "apigw-request-id": "test-apigw-request-id",
      "nhsd-correlation-id": "test-nhsd-correlation-id",
      "nhsd-request-id": "test-nhsd-request-id",
      "x-correlation-id": "test-x-correlation-id",
      "x-request-id": "test-x-request-id"
    })
  })

  it("return error when spine does not respond in time", async () => {
    mock.onGet("https://live/mm/patientfacingprescriptions").timeout()
    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    const result: APIGatewayProxyResult = (await handler(event, dummyContext))
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(resultBody.fhir).toEqual(responseStatus500)
  })

  it("return error when the certificate is not configured", async () => {
    process.env.SpinePublicCertificate = "ChangeMe"
    process.env.SpinePrivateKey = "ChangeMe"
    process.env.SpineCAChain = "ChangeMe"

    mock.onGet("https://live/mm/patientfacingprescriptions").reply(500, {resourceType: "Bundle"})
    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    const result: APIGatewayProxyResult = await handler(event, dummyContext)
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toBe(500)
    expect(result.headers).toEqual(HEADERS)
    expect(resultBody.fhir).toEqual(responseNotConfCertStatus500)
  })

  it("timeout if spine call takes too long", async () => {
    const delayedResponse: Promise<Array<unknown>> = new Promise((resolve) => setTimeout(() => resolve([]), 15_000))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mock.onGet("https://live/mm/patientfacingprescriptions").reply((_config) => delayedResponse)

    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
    const eventHandler: Promise<APIGatewayProxyResult> = handler(event, dummyContext)

    await jest.advanceTimersByTimeAsync(11_000)

    const result = await eventHandler
    expect(result.statusCode).toBe(408)
    expect(result.headers).toEqual(HEADERS)
    expect(result.body).toEqual(stateMachineLambdaResponse(408, TIMEOUT_RESPONSE).body)
  })
})

describe("Unit tests for app handler including service search", function () {
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
    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    mock.onGet(
      "https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "flm49"}}
    ).reply(200, JSON.parse(pharmacy2uResponse))

    mock.onGet(
      "https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "few08"}}
    ).reply(200, JSON.parse(pharmicaResponse))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))
    const resultA: APIGatewayProxyResult = (await handler(event, dummyContext))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))
    const resultB: APIGatewayProxyResult = (await handler(event, dummyContext))

    for (const result of [resultA, resultB]) {
      const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)
      expect(result.statusCode).toEqual(200)
      expect(resultBody.fhir).not.toEqual(mockAPIResponseBody)
      expect(result.headers).toEqual(HEADERS)
    }

    expect(mock.history.get.length).toEqual(3)
  })

  it("integration test adding urls to performer organisations", async () => {
    const interactionResponse = JSON.parse(exampleInteractionResponse)

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, interactionResponse)

    mock.onGet(
      "https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "flm49"}}
    ).reply(200, JSON.parse(pharmacy2uResponse))

    mock.onGet(
      "https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "few08"}}
    ).reply(200, JSON.parse(pharmicaResponse))

    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)

    const result: APIGatewayProxyResult = (await handler(event, dummyContext))
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toEqual(200)
    expect(resultBody.fhir).not.toEqual(mockAPIResponseBody)
    expect(result.headers).toEqual(HEADERS)
  })

  it("return un-enhanced data if service search call takes too long", async () => {
    const exampleResponse = {resourceType: "Bundle"}
    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, exampleResponse)

    const delayedResponse: Promise<Array<unknown>> = new Promise((resolve) => setTimeout(() => resolve([]), 15_000))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mock.onGet("https://service-search/service-search").reply((_config) => delayedResponse)

    const event: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
    const eventHandler: Promise<APIGatewayProxyResult> = handler(event, dummyContext)

    await jest.advanceTimersByTimeAsync(8_000)

    const result = await eventHandler
    const resultBody: StateMachineFunctionResponseBody = JSON.parse(result.body)

    expect(result.statusCode).toBe(200)
    expect(result.headers).toEqual(HEADERS)
    expect(resultBody.fhir).not.toEqual({...exampleResponse, id: "test-x-request-id"})
  })
})

it("logs the correct apigw-request-id on multiple calls", async () => {
  const mockLoggerInfo = jest.spyOn(global.console, "info")

  mock.onGet("https://live/mm/patientfacingprescriptions").reply(200, {statusCode: "0"})

  const event_one: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
  const event_two: GetMyPrescriptionsEvent = JSON.parse(exampleStateMachineEvent)
  event_two.headers["apigw-request-id"] = "test-apigw-request-id-two"

  await handler(event_one, dummyContext)
  await handler(event_two, dummyContext)

  expect(mockLoggerInfo).toHaveBeenCalledWith(
    expect.toMatchJsonLogMessage("apigw-request-id", "test-apigw-request-id", "")
  )

  expect(mockLoggerInfo).toHaveBeenCalledWith(
    expect.toMatchJsonLogMessage("apigw-request-id", "test-apigw-request-id-two", "")
  )
})

export {}
