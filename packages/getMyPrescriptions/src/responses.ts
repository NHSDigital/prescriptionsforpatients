import {Bundle, FhirResource, OperationOutcome} from "fhir/r4"
import {StatusUpdateData} from "./statusUpdate"
import {APIGatewayProxyResult} from "aws-lambda"

export type FhirBody = Bundle<FhirResource> | OperationOutcome

export type StateMachineFunctionResponseBody = {
  fhir: FhirBody
  statusUpdateData?: {
    schemaVersion: number
    prescriptions: Array<StatusUpdateData>
  }
}

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

export function stateMachineLambdaResponse(
  fhirBody: FhirBody, statusUpdateData?: Array<StatusUpdateData>
): APIGatewayProxyResult {
  const body: StateMachineFunctionResponseBody = {fhir: fhirBody}
  if (statusUpdateData) {
    body.statusUpdateData = {
      schemaVersion: 1,
      prescriptions: statusUpdateData
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: HEADERS
  }
}

export function apiGatewayLambdaResponse(fhirBody: FhirBody): APIGatewayProxyResult {
  return {
    statusCode: 200,
    body: JSON.stringify(fhirBody),
    headers: HEADERS
  }
}
