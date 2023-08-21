import {APIGatewayProxyEvent} from "aws-lambda"
import * as _mockAPIGatewayProxyEvent from "./mockAPIGatewayProxyEvent.json"
import {test_mime_type} from "./test_mime_type"

const mockAPIGatewayProxyEvent: APIGatewayProxyEvent = _mockAPIGatewayProxyEvent

export {mockAPIGatewayProxyEvent, test_mime_type}
