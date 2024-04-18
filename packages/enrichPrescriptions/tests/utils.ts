/* eslint-disable @typescript-eslint/no-explicit-any */

import {EnrichPrescriptionsEvent} from "../src/enrichPrescriptions"
import {HEADERS, StateMachineFunctionResponse} from "../src/responses"

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

export function simpleEventAndResponse(): RequestAndResponse {
  return {
    event: {
      Payload: {
        body: {fhir: simpleRequestBundle()}
      },
      StatusUpdates: {Payload: simpleStatusUpdates()}
    },
    response: {
      statusCode: 200,
      headers: HEADERS,
      body: simpleResponseBundle()
    }
  }
}

export function richEventAndResponse(): RequestAndResponse {
  return {
    event: {
      Payload: {
        body: {fhir: richRequestBundle()}
      },
      StatusUpdates: {Payload: richStatusUpdates()}
    },
    response: {
      statusCode: 200,
      headers: HEADERS,
      body: richResponseBundle()
    }
  }
}
