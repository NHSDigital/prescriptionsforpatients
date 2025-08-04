import {Bundle, BundleEntry, OperationOutcome} from "fhir/r4"
import {StatusUpdateData, shouldGetStatusUpdates} from "./statusUpdate"
import {APIGatewayProxyResult as LambdaResult} from "aws-lambda"
import {v4} from "uuid"
import {logger} from "./getMyPrescriptions"

const TC009_MULTIPLE_EXCLUDED_PRESCRIPTIONS_NHS_NUMBER = "9997750640"

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
  nhsNumber: string,
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

// AEA-5653 | TC008: Manually triggered error message
export const TC008_ERROR_RESPONSE: LambdaResult = {
  statusCode: 500,
  body: JSON.stringify({
    resourceType: "OperationOutcome",
    issue: [
      {
        code: "exception",
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
        diagnostics: "Error intentionally triggered for testing purposes"
      }
    ]
  }),
  headers: HEADERS
}

export function createExcludedPrescriptionEntry(): BundleEntry {
  const outcomeId = v4()
  const now = new Date().toISOString()

  // Generate a short ID. 3 blocks of 6 alphanumeric characters
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  // This doesn't need to be cryptographically secure. Math.random is fine here.
  const rand = Uint8Array.from({length: 18}, () => Math.floor(Math.random() * CHARS.length))

  let shortFormId = ""
  for (const num of rand) {
    shortFormId += CHARS[num]
    if (shortFormId.length === 6 || shortFormId.length === 12) shortFormId += "-"
  }

  const operationOutcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    id: outcomeId,
    meta: {
      lastUpdated: now
    },
    issue: [
      {
        code: "business-rule",
        severity: "warning",
        details: {
          coding: [
            {
              system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
              code: "INVALIDATED_RESOURCE",
              display: "Invalidated resource"
            }
          ]
        },
        diagnostics: `Prescription with short form ID ${shortFormId} has been invalidated so could not be returned.`
      }
    ]
  }

  const response: BundleEntry = {
    fullUrl: `urn:uuid:${v4()}`,
    search: {
      mode: "outcome"
    },
    resource: operationOutcome
  }

  logger.debug("Generated a dummy excluded prescription summary block", {dummyExcludedBlock: response})
  return response
}

export function stateMachineLambdaResponse(
  nhsNumber: string,
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

  if (nhsNumber === TC009_MULTIPLE_EXCLUDED_PRESCRIPTIONS_NHS_NUMBER) {
    // When testing with TC009, inject our dummy excluded‐prescription entry
    if ((body.fhir as Bundle).entry) {
      const bundle = body.fhir as Bundle

      // If we have no entries, create an empty array
      bundle.entry ??= []
      bundle.entry.push(createExcludedPrescriptionEntry())
      bundle.entry.push(createExcludedPrescriptionEntry())
      logger.info(
        "Test NHS number corresponding to TC009 has been received. Appending an excluded prescription entry"
      )
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: HEADERS
  }
}
