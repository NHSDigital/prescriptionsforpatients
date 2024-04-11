import {Bundle, FhirResource, OperationOutcome} from "fhir/r4"
import {StatusUpdateData} from "./statusUpdate"

type FhirBody = Bundle<FhirResource> | OperationOutcome

export type StateMachineFunctionResponse = {
  statusCode: number
  body: FhirBody
  headers: object
  statusUpdateData: Array<StatusUpdateData>
}

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export function generalError(responseBodyId: string): OperationOutcome {
  return {
    id: responseBodyId,
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

export function lambdaResponse(
  statusCode: number, fhirBody: FhirBody, statusUpdateData: Array<StatusUpdateData> = []
): StateMachineFunctionResponse {
  return {
    statusCode: statusCode,
    body: fhirBody,
    headers: HEADERS,
    statusUpdateData: statusUpdateData
  }
}
