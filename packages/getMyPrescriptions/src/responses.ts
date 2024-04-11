import {APIGatewayProxyResult} from "aws-lambda"
import {Bundle, FhirResource, OperationOutcome} from "fhir/r4"

type StatusUpdateData = {odsCode: string, prescriptionID: string}
type FhirBody = Bundle<FhirResource> | OperationOutcome

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
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
): APIGatewayProxyResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = fhirBody as any
  if (statusCode === 200) {
    body.statusUpdateData = statusUpdateData
  }
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: HEADERS
  }
}
