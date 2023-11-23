import {APIGatewayProxyEvent} from "aws-lambda"

import {test_mime_type} from "./test_mime_type"
import {test_append_trace_ids} from "./test_append_trace_id"

import _mockAPIGatewayProxyEvent from "./mockAPIGatewayProxyEvent.json"
const mockAPIGatewayProxyEvent: APIGatewayProxyEvent = _mockAPIGatewayProxyEvent

export {mockAPIGatewayProxyEvent}
export {test_mime_type}
export {test_append_trace_ids}
