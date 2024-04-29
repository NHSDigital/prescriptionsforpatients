import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle, FhirResource, OperationOutcome} from "fhir/r4"

type FhirBody = Bundle<FhirResource> | OperationOutcome

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export function lambdaResponse(statusCode: number, fhirBody: FhirBody): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(fhirBody),
    headers: HEADERS
  }
}
