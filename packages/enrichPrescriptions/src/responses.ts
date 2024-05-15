import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle} from "fhir/r4"

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export type TraceIDs = {
  "nhsd-correlation-id": string
  "x-request-id": string
  "nhsd-request-id": string
  "x-correlation-id": string
  "apigw-request-id": string
}

export function lambdaResponse(statusCode: number, body: Bundle, traceIDs: TraceIDs): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {...HEADERS, ...traceIDs}
  }
}
