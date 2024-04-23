/* eslint-disable max-len */

import "jest"
import axios from "axios"
import {Bundle} from "fhir/r4"
import {APIGatewayProxyEvent} from "aws-lambda"
import MockAdapter from "axios-mock-adapter"

import {
  mockAPIGatewayProxyEvent,
  mockAPIResponseBody,
  mockInteractionResponseBody,
  mockPharmacy2uResponse,
  mockPharmicaResponse
} from "@prescriptionsforpatients_common/testing"

import {buildStatusUpdateData} from "../src/statusUpdate"
import {StateMachineFunctionResponse, lambdaResponse} from "../src/responses"
import {eventHandler} from "../src/getMyPrescriptions"
import {SERVICE_SEARCH_PARAMS} from "./utils"

const exampleEvent = JSON.stringify(mockAPIGatewayProxyEvent)
const exampleInteractionResponse = JSON.stringify(mockInteractionResponseBody)

const pharmacy2uResponse = JSON.stringify(mockPharmacy2uResponse)
const pharmicaResponse = JSON.stringify(mockPharmicaResponse)

const mock = new MockAdapter(axios)

describe("Unit tests for statusUpdate", () => {
  test("when a bundle is passed-in, expected status update data is returned for prescriptions with performers without duplicates", async () => {
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
})

describe("Unit tests for handler, including statusUpdate", function () {
  beforeEach(() => {
    process.env.TargetSpineServer = "spine"
    process.env.TargetServiceSearchServer = "service-search"
    process.env.SpinePublicCertificate = "public-certificate"
    process.env.SpinePrivateKey = "private-key"
    process.env.SpineCAChain = "ca-chain"
  })

  it("when event is processed, statusUpdateData is included in the response", async () => {
    const event: APIGatewayProxyEvent = JSON.parse(exampleEvent)

    mock.onGet("https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "flm49"}}).reply(200, JSON.parse(pharmacy2uResponse))
    mock.onGet("https://service-search/service-search", {params: {...SERVICE_SEARCH_PARAMS, search: "few08"}}).reply(200, JSON.parse(pharmicaResponse))

    mock.onGet("https://spine/mm/patientfacingprescriptions").reply(200, JSON.parse(exampleInteractionResponse))

    const result: StateMachineFunctionResponse = await eventHandler(event)

    const statusUpdateData = [
      {odsCode: "FLM49", prescriptionID: "24F5DA-A83008-7EFE6Z"},
      {odsCode: "FEW08", prescriptionID: "16B2E0-A83008-81C13H"}
    ]
    const expected = lambdaResponse(200, mockAPIResponseBody as Bundle, statusUpdateData)

    expect(result).not.toEqual(expected)
  })
})
