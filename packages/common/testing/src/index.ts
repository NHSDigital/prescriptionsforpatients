import {APIGatewayProxyEvent} from "aws-lambda"

import {test_mime_type} from "./test_mime_type"
import {test_append_trace_ids} from "./test_append_trace_id"

import _mockAPIGatewayProxyEvent from "./mockAPIGatewayProxyEvent.json"
const mockAPIGatewayProxyEvent: APIGatewayProxyEvent = _mockAPIGatewayProxyEvent

import _mockServiceSearchResponseBody from "./mockServiceSearchResponseBody.json"
const mockServiceSearchResponseBody = _mockServiceSearchResponseBody

import _mockInteractionResponseBody from "./mockInteractionResponseBody.json"
const mockInteractionResponseBody = _mockInteractionResponseBody

import _mockAPIResponseBody from "./mockAPIResponseBody.json"
const mockAPIResponseBody = _mockAPIResponseBody

export {
  mockAPIGatewayProxyEvent,
  mockServiceSearchResponseBody,
  mockInteractionResponseBody,
  mockAPIResponseBody,
  test_mime_type,
  test_append_trace_ids
}
