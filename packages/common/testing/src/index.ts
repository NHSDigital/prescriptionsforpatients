import {APIGatewayProxyEvent} from "aws-lambda"

import {test_mime_type} from "./test_mime_type"
import {test_append_trace_ids} from "./test_append_trace_id"

import _mockAPIGatewayProxyEvent from "./mockAPIGatewayProxyEvent.json"
const mockAPIGatewayProxyEvent: APIGatewayProxyEvent = _mockAPIGatewayProxyEvent

import _mockServiceSearchResponseBody from "./mockServiceSearchResponseBody.json"
const mockServiceSearchResponseBody = _mockServiceSearchResponseBody

import _mockInteractionResponseBody from "./mockInteractionResponseBody.json"
const mockInteractionResponseBody = _mockInteractionResponseBody

export {mockAPIGatewayProxyEvent}
export {mockServiceSearchResponseBody}
export {mockInteractionResponseBody}

export {test_mime_type}
export {test_append_trace_ids}
