/* eslint-disable max-len */

import {
  expect,
  describe,
  it,
  jest
} from "@jest/globals"
import axios from "axios"
import {Bundle, MedicationRequest} from "fhir/r4"
import {APIGatewayProxyResult as LambdaResult, Context} from "aws-lambda"
import MockAdapter from "axios-mock-adapter"

import {
  helloworldContext,
  mockAPIResponseBody as mockResponseBody,
  mockInteractionResponseBody,
  mockPharmacy2uResponse,
  mockPharmicaResponse,
  mockStateMachineInputEvent
} from "@prescriptionsforpatients_common/testing"

import {buildStatusUpdateData} from "../src/statusUpdate"
import {StateMachineFunctionResponseBody} from "../src/responses"
import {
  DEFAULT_HANDLER_PARAMS,
  GetMyPrescriptionsEvent,
  STATE_MACHINE_MIDDLEWARE,
  newHandler,
  stateMachineEventHandler
} from "../src/getMyPrescriptions"
import {EXPECTED_TRACE_IDS, SERVICE_SEARCH_PARAMS} from "./utils"
import {LogLevel} from "@aws-lambda-powertools/logger/types"
import {Logger} from "@aws-lambda-powertools/logger"
import {createSpineClient} from "@nhsdigital/eps-spine-client"
import {MiddyfiedHandler} from "@middy/core"

const exampleEvent = JSON.stringify(mockStateMachineInputEvent)
const exampleInteractionResponse = JSON.stringify(mockInteractionResponseBody)

const pharmacy2uResponse = JSON.stringify(mockPharmacy2uResponse)
const pharmicaResponse = JSON.stringify(mockPharmicaResponse)

const dummyContext = helloworldContext
const mock = new MockAdapter(axios)

describe("Unit tests for statusUpdate", () => {
  test("when a bundle is passed-in, expected status update data is returned for prescriptions with performers, without duplicates", async () => {
    const bundle = mockInteractionResponseBody as Bundle
    const result = buildStatusUpdateData(bundle)
    expect(result).toEqual([
      {
        odsCode: "FLM49",
        prescriptionID: "24F5DA-A83008-7EFE6Z"
      },
      {
        odsCode: "FEW08",
        prescriptionID: "16B2E0-A83008-81C13H"
      }
    ])
  })

  test("when an empty bundle is passed-in, status update data is empty", async () => {
    const bundle: Bundle = {resourceType: "Bundle", type: "searchset"}
    const result = buildStatusUpdateData(bundle)
    expect(result).toEqual([])
  })

  test.each([
    {status: "Prescriber Cancelled", expectedLength: 1},
    {status: "Prescriber Approved", expectedLength: 1},
    {status: "Other", expectedLength: 2}
  ])(
    "excludes prescriptions where all items have a status of either 'Prescriber Approved' or 'Prescriber Cancelled'",
    async ({status, expectedLength}) => {
      const bundle = mockInteractionResponseBody as Bundle

      const collectionBundle = bundle.entry![2].resource as Bundle
      const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
      medicationRequest.extension = [
        {
          url: "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory",
          extension: [
            {
              url: "status",
              valueCoding: {code: status}
            },
            {
              url: "statusDate",
              valueDateTime: new Date().toISOString()
            }
          ]
        }
      ]

      const result = buildStatusUpdateData(bundle)

      expect(result.length).toBe(expectedLength)
    }
  )
})

describe("Unit tests for statusUpdate, via handler", function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: MiddyfiedHandler<GetMyPrescriptionsEvent, LambdaResult, Error, Context, any>
  beforeEach(() => {
    process.env.TargetSpineServer = "spine"
    process.env.TargetServiceSearchServer = "service-search"
    process.env.SpinePublicCertificate = "public-certificate"
    process.env.SpinePrivateKey = "private-key"
    process.env.SpineCAChain = "ca-chain"
    process.env.GET_STATUS_UPDATES = "true"
    const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel
    const logger = new Logger({serviceName: "getMyPrescriptions", logLevel: LOG_LEVEL})
    const _spineClient = createSpineClient(logger)
    const handlerParams = {...DEFAULT_HANDLER_PARAMS, spineClient: _spineClient}
    handler = newHandler({
      handlerFunction: stateMachineEventHandler,
      params: handlerParams,
      middleware: STATE_MACHINE_MIDDLEWARE
    })
    jest.useFakeTimers()
  })

  it("when event is processed, statusUpdateData is included in the response", async () => {
    const event: GetMyPrescriptionsEvent = JSON.parse(exampleEvent)

    mock
      .onGet("https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "flm49"}})
      .reply(200, JSON.parse(pharmacy2uResponse))
    mock
      .onGet("https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "few08"}})
      .reply(200, JSON.parse(pharmicaResponse))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))

    const result: LambdaResult = await handler(event, dummyContext)

    const statusUpdateData = {
      schemaVersion: 1,
      prescriptions: [
        {odsCode: "FLM49", prescriptionID: "24F5DA-A83008-7EFE6Z"},
        {odsCode: "FEW08", prescriptionID: "16B2E0-A83008-81C13H"}
      ]
    }
    const expected: StateMachineFunctionResponseBody = {
      fhir: mockResponseBody as Bundle,
      getStatusUpdates: true,
      statusUpdateData: statusUpdateData,
      traceIDs: EXPECTED_TRACE_IDS
    }

    expect(JSON.parse(result.body)).toEqual(expected)
  })
})
