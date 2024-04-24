/* eslint-disable @typescript-eslint/no-explicit-any */

import {Bundle, Extension} from "fhir/r4"

import {EnrichPrescriptionsEvent} from "../src/enrichPrescriptions"
import {HEADERS, StateMachineFunctionResponse} from "../src/responses"
import {
  DEFAULT_EXTENSION_STATUS,
  EXTENSION_URL,
  StatusUpdates,
  VALUE_CODING_SYSTEM
} from "../src/statusUpdates"

import simpleRequestBundle from "./data/simple/requestBundle.json"
import simpleStatusUpdates from "./data/simple/statusUpdates.json"
import simpleResponseBundle from "./data/simple/responseBundle.json"

import richRequestBundle from "./data/rich/requestBundle.json"
import richStatusUpdates from "./data/rich/statusUpdates.json"
import richResponseBundle from "./data/rich/responseBundle.json"
import unalteredResponseBundle from "./data/unalteredResponseBundle.json"

const simpleRequestBundleString = JSON.stringify(simpleRequestBundle)
const simpleStatusUpdatesString = JSON.stringify(simpleStatusUpdates)
const simpleResponseBundleString = JSON.stringify(simpleResponseBundle)

const richRequestBundleString = JSON.stringify(richRequestBundle)
const richStatusUpdatesString = JSON.stringify(richStatusUpdates)
const richResponseBundleString = JSON.stringify(richResponseBundle)
const unalteredResponseBundleString = JSON.stringify(unalteredResponseBundle)

type RequestAndResponse = {
  event: EnrichPrescriptionsEvent
  expectedResponse: StateMachineFunctionResponse
}

export const SYSTEM_DATETIME = new Date("2023-09-11T10:11:12.000Z")

function eventAndResponse(
  requestBundle: Bundle,
  responseBundle: Bundle,
  statusUpdates?: StatusUpdates
): RequestAndResponse {
  const requestAndResponse: RequestAndResponse = {
    event: {
      Payload: {
        body: {fhir: requestBundle}
      }
    },
    expectedResponse: {
      statusCode: 200,
      headers: HEADERS,
      body: responseBundle
    }
  }
  if (statusUpdates) {
    requestAndResponse.event.StatusUpdates = {Payload: statusUpdates}
  }
  return requestAndResponse
}

export function simpleEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    JSON.parse(simpleRequestBundleString),
    JSON.parse(simpleResponseBundleString),
    JSON.parse(simpleStatusUpdatesString)
  )
}

export function richEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    JSON.parse(richRequestBundleString),
    JSON.parse(richResponseBundleString),
    JSON.parse(richStatusUpdatesString)
  )
}

export function unsuccessfulEventAndResponse(): RequestAndResponse {
  const unsuccessfulStatusUpdates = JSON.parse(simpleStatusUpdatesString)
  unsuccessfulStatusUpdates.isSuccess = false

  return eventAndResponse(
    JSON.parse(simpleRequestBundleString),
    JSON.parse(unalteredResponseBundleString),
    unsuccessfulStatusUpdates
  )
}

export function noUpdateDataEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    JSON.parse(simpleRequestBundleString),
    JSON.parse(unalteredResponseBundleString)
  )
}

export function defaultExtension(): Array<Extension> {
  return [{
    url: EXTENSION_URL,
    extension: [
      {
        url: "status",
        valueCoding: {
          system: VALUE_CODING_SYSTEM,
          code: DEFAULT_EXTENSION_STATUS
        }
      },
      {
        url: "statusDate",
        valueDateTime: SYSTEM_DATETIME.toISOString()
      }
    ]
  }]
}
