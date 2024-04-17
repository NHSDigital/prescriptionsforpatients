import {Bundle, FhirResource, OperationOutcome} from "fhir/r4"

type FhirBody = Bundle<FhirResource> | OperationOutcome

export type StateMachineFunctionResponse = {
  statusCode: number
  body: FhirBody
  headers: object
}

export const HEADERS = {
  "Content-Type": "application/fhir+json",
  "Cache-Control": "no-cache"
}

export function lambdaResponse(statusCode: number, fhirBody: FhirBody): StateMachineFunctionResponse {
  return {
    statusCode: statusCode,
    body: fhirBody,
    headers: HEADERS
  }
}
