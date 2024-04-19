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

import {simpleRequestBundle} from "./data/simple/requestBundle"
import {simpleStatusUpdates} from "./data/simple/statusUpdates"
import {simpleResponseBundle} from "./data/simple/responseBundle"

import {richRequestBundle} from "./data/rich/requestBundle"
import {richStatusUpdates} from "./data/rich/statusUpdates"
import {richResponseBundle} from "./data/rich/responseBundle"

type RequestAndResponse = {
  event: EnrichPrescriptionsEvent
  response: StateMachineFunctionResponse
}

export const SYSTEM_DATETIME = new Date("2023-09-11T10:11:12.000Z")

function eventAndResponse(
  requestBundle: Bundle,
  statusUpdates: StatusUpdates,
  responseBundle: Bundle
): RequestAndResponse {
  return {
    event: {
      Payload: {
        body: {fhir: requestBundle}
      },
      StatusUpdates: {Payload: statusUpdates}
    },
    response: {
      statusCode: 200,
      headers: HEADERS,
      body: responseBundle
    }
  }
}

export function simpleEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    simpleRequestBundle(),
    simpleStatusUpdates(),
    simpleResponseBundle()
  )
}

export function richEventAndResponse(): RequestAndResponse {
  return eventAndResponse(
    richRequestBundle(),
    richStatusUpdates(),
    richResponseBundle()
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
