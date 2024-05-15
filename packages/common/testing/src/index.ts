import {APIGatewayProxyEvent} from "aws-lambda"

import {test_mime_type} from "./test_mime_type"
import {test_append_trace_ids} from "./test_append_trace_id"
import {helloworldContext} from "./helloWorldContext"

import _mockAPIGatewayProxyEvent from "./mockAPIGatewayProxyEvent.json"
const mockAPIGatewayProxyEvent: APIGatewayProxyEvent = _mockAPIGatewayProxyEvent

import _mockStateMachineInputEvent from "./mockStateMachineInputEvent.json"
const mockStateMachineInputEvent = _mockStateMachineInputEvent

import _mockServiceSearchResponseBodyPharmacy2u from "./mockServiceSearchResponseBodyPharmacy2u.json"
const mockPharmacy2uResponse = _mockServiceSearchResponseBodyPharmacy2u

import _mockServiceSearchResponseBodyPharmica from "./mockServiceSearchResponseBodyPharmica.json"
const mockPharmicaResponse = _mockServiceSearchResponseBodyPharmica

import _mockInteractionResponseBody from "./mockInteractionResponseBody.json"
const mockInteractionResponseBody = _mockInteractionResponseBody

import _mockAPIResponseBody from "./mockAPIResponseBody.json"
const mockAPIResponseBody = _mockAPIResponseBody

export {
  mockAPIGatewayProxyEvent,
  mockStateMachineInputEvent,
  mockPharmacy2uResponse,
  mockPharmicaResponse,
  mockInteractionResponseBody,
  mockAPIResponseBody,
  test_mime_type,
  test_append_trace_ids,
  helloworldContext
}
