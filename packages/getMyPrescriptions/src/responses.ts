import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle, FhirResource} from "fhir/r4"

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export const TIMEOUT_RESPONSE: APIGatewayProxyResult = {
  statusCode: 408,
  body: JSON.stringify({
    resourceType: "OperationOutcome",
    issue: [
      {
        code: "timeout",
        severity: "fatal",
        details: {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
              code: "TIMEOUT",
              display: "408: The request timed out."
            }
          ]
        }
      }
    ]
  }),
  headers: HEADERS
}

export const SPINE_CERT_NOT_CONFIGURED_RESPONSE: APIGatewayProxyResult = {
  statusCode: 500,
  body: JSON.stringify({
    resourceType: "OperationOutcome",
    issue: [
      {
        code: "security",
        severity: "fatal",
        details: {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
              code: "SERVER_ERROR",
              display: "500: The Server has encountered an error processing the request."
            }
          ]
        },
        diagnostics: "Spine certificate is not configured"
      }
    ]
  }),
  headers: HEADERS
}

export const INVALID_NHS_NUMBER_RESPONSE: APIGatewayProxyResult = {
  statusCode: 400,
  body: JSON.stringify({
    resourceType: "OperationOutcome",
    issue: [
      {
        code: "value",
        severity: "error",
        details: {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
              code: "INVALID_RESOURCE_ID",
              display: "Invalid resource ID"
            }
          ]
        }
      }
    ]
  }),
  headers: HEADERS
}

export function successResponse(searchsetBundle: Bundle<FhirResource>): APIGatewayProxyResult {
  return {
    statusCode: 200,
    body: JSON.stringify(searchsetBundle),
    headers: HEADERS
  }
}
