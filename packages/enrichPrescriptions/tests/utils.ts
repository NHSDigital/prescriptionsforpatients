/* eslint-disable @typescript-eslint/no-explicit-any */

import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle, Extension} from "fhir/r4"

import {EnrichPrescriptionsEvent} from "../src/enrichPrescriptions"
import {HEADERS, TraceIDs} from "../src/responses"
import {
  DEFAULT_EXTENSION_STATUS,
  EXTENSION_URL,
  NOT_ONBOARDED_DEFAULT_EXTENSION_STATUS,
  StatusUpdates,
  VALUE_CODING_SYSTEM
} from "../src/statusUpdates"

import simpleRequest from "./data/simple/requestBundle.json"
import simpleRequestPA from "./data/simple/requestBundlePA.json"
import simpleRequestCancelled from "./data/simple/requestBundleCancelled.json"
import simpleStatusUpdates from "./data/simple/statusUpdates.json"
import simpleStatusUpdatesPA from "./data/simple/statusUpdatesPA.json"
import simpleStatusUpdatesCancelled from "./data/simple/statusUpdatesCancelled.json"
import simpleResponse from "./data/simple/responseBundle.json"
import simpleResponsePA from "./data/simple/responseBundlePA.json"
import simpleResponseCancelled from "./data/simple/responseBundleCancelled.json"

import richRequest from "./data/rich/requestBundle.json"
import richStatusUpdates from "./data/rich/statusUpdates.json"
import richResponse from "./data/rich/responseBundle.json"

const simpleRequestString = JSON.stringify(simpleRequest)
const simpleRequestStringPA = JSON.stringify(simpleRequestPA)
const simpleRequestStringCancelled = JSON.stringify(simpleRequestCancelled)
const simpleStatusUpdatesString = JSON.stringify(simpleStatusUpdates)
const simpleStatusUpdatesStringPA = JSON.stringify(simpleStatusUpdatesPA)
const simpleStatusUpdatesStringCancelled = JSON.stringify(simpleStatusUpdatesCancelled)
const simpleResponseString = JSON.stringify(simpleResponse)
const simpleResponseStringPA = JSON.stringify(simpleResponsePA)
const simpleResponseStringCancelled = JSON.stringify(simpleResponseCancelled)

const richRequestString = JSON.stringify(richRequest)
const richStatusUpdatesString = JSON.stringify(richStatusUpdates)
const richResponseString = JSON.stringify(richResponse)

export const simpleRequestBundle = () => JSON.parse(simpleRequestString) as Bundle
export const simpleRequestBundlePA = () => JSON.parse(simpleRequestStringPA) as Bundle
export const simpleRequestBundleCancelled = () => JSON.parse(simpleRequestStringCancelled) as Bundle
export const simpleStatusUpdatesPayload = () => JSON.parse(simpleStatusUpdatesString) as StatusUpdates
export const simpleStatusUpdatesPayloadPA = () => JSON.parse(simpleStatusUpdatesStringPA) as StatusUpdates
export const simpleStatusUpdatesPayloadCancelled = () => JSON.parse(simpleStatusUpdatesStringCancelled) as StatusUpdates
export const simpleResponseBundle = () => JSON.parse(simpleResponseString) as Bundle
export const simpleResponseBundlePA = () => JSON.parse(simpleResponseStringPA) as Bundle
export const simpleResponseBundleCancelled = () => JSON.parse(simpleResponseStringCancelled) as Bundle

export const richRequestBundle = () => JSON.parse(richRequestString) as Bundle
export const richStatusUpdatesPayload = () => JSON.parse(richStatusUpdatesString) as StatusUpdates
export const richResponseBundle = () => JSON.parse(richResponseString) as Bundle

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
  statusUpdates?: StatusUpdates
): RequestAndResponse {
  const requestAndResponse: RequestAndResponse = {
    event: {
      fhir: requestBundle,
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
  return requestAndResponse
}

export function simpleEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    simpleRequestBundle(),
    simpleResponseBundle(),
    simpleStatusUpdatesPayload()
  )
}

export function richEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    richRequestBundle(),
    richResponseBundle(),
    richStatusUpdatesPayload()
  )
}

export function unsuccessfulEventAndResponse(): RequestAndResponse {
  const unsuccessfulStatusUpdates = simpleStatusUpdatesPayload()
  unsuccessfulStatusUpdates.isSuccess = false

  return eventAndResponse(
    simpleRequestBundle(),
    simpleRequestBundle(),
    unsuccessfulStatusUpdates
  )
}

export function noUpdateDataEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    simpleRequestBundle(),
    simpleRequestBundle()
  )
}

export function defaultExtension(onboarded: boolean = true): Array<Extension> {
  return [{
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
  }]
}
