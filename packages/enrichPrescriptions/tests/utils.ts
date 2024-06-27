// tests/utils.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle, Extension, MedicationRequest} from "fhir/r4"

import {EnrichPrescriptionsEvent} from "../src/enrichPrescriptions"
import {HEADERS, TraceIDs} from "../src/responses"
import {
  DEFAULT_EXTENSION_STATUS,
  EXTENSION_URL,
  NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS,
  StatusUpdateData,
  StatusUpdates,
  TEMPORARILY_UNAVAILABLE_STATUS,
  VALUE_CODING_SYSTEM
} from "../src/statusUpdates"

import simpleRequest from "./data/simple/requestBundle.json"
import simpleStatusUpdates from "./data/simple/statusUpdates.json"
import simpleResponse from "./data/simple/responseBundle.json"

import richRequest from "./data/rich/requestBundle.json"
import richStatusUpdates from "./data/rich/statusUpdates.json"
import richResponse from "./data/rich/responseBundle.json"

const simpleRequestString = JSON.stringify(simpleRequest)
const simpleStatusUpdatesString = JSON.stringify(simpleStatusUpdates)
const simpleResponseString = JSON.stringify(simpleResponse)

const richRequestString = JSON.stringify(richRequest)
const richStatusUpdatesString = JSON.stringify(richStatusUpdates)
const richResponseString = JSON.stringify(richResponse)

export const simpleRequestBundle = () => JSON.parse(simpleRequestString) as Bundle
export const simpleStatusUpdatesPayload = () => JSON.parse(simpleStatusUpdatesString) as StatusUpdates
export const simpleResponseBundle = () => JSON.parse(simpleResponseString) as Bundle

export const richRequestBundle = () => JSON.parse(richRequestString) as Bundle
export const richStatusUpdatesPayload = () => JSON.parse(richStatusUpdatesString) as StatusUpdates
export const richResponseBundle = () => JSON.parse(richResponseString) as Bundle

export const OUTER_EXTENSION_URL = "https://fhir.nhs.uk/StructureDefinition/Extension-DM-PrescriptionStatusHistory"
export const INNER_EXTENSION_URL = "https://fhir.nhs.uk/CodeSystem/task-businessStatus-nppt"

type RequestAndResponse = {
  event: EnrichPrescriptionsEvent
  expectedResponse: APIGatewayProxyResult
}

export const SYSTEM_DATETIME = new Date("2023-09-11T10:11:12.000Z")

const TRACE_IDS: TraceIDs = {
  "apigw-request-id": "test-apigw-request-id",
  "nhsd-correlation-id": "test-nhsd-correlation-id",
  "nhsd-request-id": "test-nhsd-request-id",
  "x-correlation-id": "test-x-correlation-id",
  "x-request-id": "test-x-request-id"
}

function eventAndResponse(
  requestBundle: Bundle,
  responseBundle: Bundle,
  statusUpdates?: StatusUpdates,
  statusUpdateData?: StatusUpdateData
): RequestAndResponse {
  const requestAndResponse: RequestAndResponse = {
    event: {
      fhir: requestBundle,
      statusUpdateData: {schemaVersion: 1, prescriptions: []},
      traceIDs: TRACE_IDS
    },
    expectedResponse: {
      statusCode: 200,
      headers: {...HEADERS, ...TRACE_IDS},
      body: JSON.stringify(responseBundle)
    }
  }
  if (statusUpdates) {
    requestAndResponse.event.StatusUpdates = {Payload: statusUpdates}
  }
  if (statusUpdateData) {
    requestAndResponse.event.statusUpdateData = statusUpdateData
  }
  return requestAndResponse
}

export function simpleEventAndResponse(): RequestAndResponse {
  return eventAndResponse(simpleRequestBundle(), simpleResponseBundle(), simpleStatusUpdatesPayload())
}

export function richEventAndResponse(): RequestAndResponse {
  return eventAndResponse(richRequestBundle(), richResponseBundle(), richStatusUpdatesPayload())
}

export function unsuccessfulEventAndResponse(): RequestAndResponse {
  const unsuccessfulStatusUpdates = simpleStatusUpdatesPayload()
  unsuccessfulStatusUpdates.isSuccess = false

  return eventAndResponse(simpleRequestBundle(), simpleRequestBundle(), unsuccessfulStatusUpdates)
}

export function noUpdateDataEventAndResponse(): RequestAndResponse {
  return eventAndResponse(simpleRequestBundle(), simpleRequestBundle())
}

export function getStatusUpdatesFailedEventAndResponse(): RequestAndResponse {
  const requestBundle = simpleRequestBundle()

  const responseBundle = simpleResponseBundle()
  const collectionBundle = responseBundle.entry![0].resource as Bundle
  const medicationRequest = collectionBundle.entry![0].resource as MedicationRequest
  medicationRequest.extension![0].extension![0].valueCoding!.code = TEMPORARILY_UNAVAILABLE_STATUS

  const statusUpdatesPayload = simpleStatusUpdatesPayload()
  statusUpdatesPayload.isSuccess = false

  const statusUpdateData = {
    schemaVersion: 1,
    prescriptions: [{odsCode: "FLM49", prescriptionID: "727066-A83008-2EFE36"}]
  }
  return eventAndResponse(requestBundle, responseBundle, statusUpdatesPayload, statusUpdateData)
}

export function defaultExtension(onboarded: boolean = true): Array<Extension> {
  return [
    {
      url: EXTENSION_URL,
      extension: [
        {
          url: "status",
          valueCoding: {
            system: VALUE_CODING_SYSTEM,
            code: onboarded ? DEFAULT_EXTENSION_STATUS : NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS
          }
        },
        {
          url: "statusDate",
          valueDateTime: SYSTEM_DATETIME.toISOString()
        }
      ]
    }
  ]
}

export function addExtensionToMedicationRequest(
  medicationRequest: MedicationRequest,
  status: string,
  statusDate: string
) {
  medicationRequest.extension = [
    {
      url: OUTER_EXTENSION_URL,
      extension: [
        {
          url: "status",
          valueCoding: {
            system: INNER_EXTENSION_URL,
            code: status
          }
        },
        {
          url: "statusDate",
          valueDateTime: statusDate
        }
      ]
    }
  ]
}

export function getStatusExtensions(medicationRequest: MedicationRequest): Array<Extension> {
  return medicationRequest.extension?.filter((ext) => ext.url === EXTENSION_URL) || []
}

export function simpleUpdateWithStatus(status: string): StatusUpdates {
  const update = simpleStatusUpdatesPayload()
  update.prescriptions[0].items[0].latestStatus = status
  return update
}
