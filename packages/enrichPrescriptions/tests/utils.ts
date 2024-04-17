/* eslint-disable @typescript-eslint/no-explicit-any */

import {EnrichPrescriptionsEvent} from "../src/enrichPrescriptions"
import {HEADERS, StateMachineFunctionResponse} from "../src/responses"

import {requestBundle} from "./data/requestBundle"
import {statusUpdates} from "./data/statusUpdates"
import {responseBundle} from "./data/responseBundle"

type RequestAndResponse = {
  event: EnrichPrescriptionsEvent
  response: StateMachineFunctionResponse
}

export function eventWithBundleAndStatusUpdates(): RequestAndResponse {
  return {
    event: {
      Payload: {
        body: {fhir: requestBundle()}
      },
      StatusUpdates: {Payload: statusUpdates()}
    },
    response: {
      statusCode: 200,
      headers: HEADERS,
      body: responseBundle()
    }
  }
}
