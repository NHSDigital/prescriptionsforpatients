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

export function generalError(responseBodyId?: string): OperationOutcome {
  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "fatal",
        code: "exception",
        details: {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/http-error-codes",
              code: "SERVER_ERROR",
              display: "500: The Server has encountered an error processing the request."
            }
          ]
        }
      }
    ]
  }
  if (responseBodyId) {
    operationOutcome.id = responseBodyId
  }
  return operationOutcome
}

export const TIMEOUT_RESPONSE: OperationOutcome = {
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
}

export const SPINE_CERT_NOT_CONFIGURED_RESPONSE: OperationOutcome = {
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
}

export const INVALID_NHS_NUMBER_RESPONSE: OperationOutcome = {
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
}

export function stateMachineLambdaResponse(
  statusCode: number, fhirBody: FhirBody, statusUpdateData?: Array<StatusUpdateData>
): APIGatewayProxyResult {
  const body: StateMachineFunctionResponseBody = {fhir: fhirBody}
  if (statusUpdateData) {
    body.statusUpdateData = {
      schemaVersion: 1,
      prescriptions: statusUpdateData
    }
  }
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: HEADERS
  }
}

export function apiGatewayLambdaResponse(
  statusCode: number, fhirBody: FhirBody
): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(fhirBody),
    headers: HEADERS
  }
}
