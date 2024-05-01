import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle} from "fhir/r4"

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export function lambdaResponse(statusCode: number, body: Bundle): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: HEADERS
  }
}
