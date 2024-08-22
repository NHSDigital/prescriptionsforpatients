import {Bundle, OperationOutcome} from "fhir/r4"
import {StatusUpdateData, shouldGetStatusUpdates} from "./statusUpdate"
import {APIGatewayProxyResult as LambdaResult} from "aws-lambda"

export type FhirBody = Bundle | OperationOutcome

export type StateMachineFunctionResponseBody = {
  fhir: FhirBody
  getStatusUpdates: boolean
  statusUpdateData?: {
    schemaVersion: number
    prescriptions: Array<StatusUpdateData>
  }
  traceIDs: TraceIDs
}

export type TraceIDs = {
  "nhsd-correlation-id"?: string
  "x-request-id"?: string
  "nhsd-request-id"?: string
  "x-correlation-id"?: string
  "apigw-request-id"?: string
}

export type ResponseFunc = (
  fhirBody: FhirBody,
  traceIDs: TraceIDs,
  statusUpdateData?: Array<StatusUpdateData>
) => LambdaResult

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export const TIMEOUT_RESPONSE: LambdaResult = {
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

export const SPINE_CERT_NOT_CONFIGURED_RESPONSE: LambdaResult = {
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

export const INVALID_NHS_NUMBER_RESPONSE: LambdaResult = {
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
  fhirBody: FhirBody,
  traceIDs: TraceIDs,
  statusUpdateData?: Array<StatusUpdateData>
): LambdaResult {
  const body: StateMachineFunctionResponseBody = {
    fhir: fhirBody,
    getStatusUpdates: shouldGetStatusUpdates(),
    traceIDs: traceIDs
  }

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
