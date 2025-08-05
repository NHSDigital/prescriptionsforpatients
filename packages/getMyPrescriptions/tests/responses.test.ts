import {jest} from "@jest/globals"

const mockV4 = jest.fn()
jest.mock("uuid", () => ({
  __esModule: true,
  v4: mockV4
}))

// I just could NOT get jest to cooperate with the mocked UUID function.
// This ended up working (thanks chatgpt) but is really ugly (THANKS chatgpt)
let createExcludedPrescriptionEntry: typeof import("../src/responses").createExcludedPrescriptionEntry

describe("createExcludedPrescriptionEntry", () => {
  const FIXED_DATE = new Date("2025-01-01T12:34:56.789Z")

  beforeAll(async () => {
    // Import the module dynamically since top-level await is not allowed
    const responsesModule = await import("../src/responses")
    createExcludedPrescriptionEntry = responsesModule.createExcludedPrescriptionEntry

    // Freeze system time
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_DATE)

    // Make Math.random deterministic (always 0)
    jest.spyOn(Math, "random").mockReturnValue(0)

    mockV4
      .mockReturnValueOnce("outcome-uuid")
      .mockReturnValueOnce("fullurl-uuid")
  })

  afterAll(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("should produce a BundleEntry with the correct structure and values", () => {
    const entry = createExcludedPrescriptionEntry()

    expect(entry.fullUrl).toBe("urn:uuid:fullurl-uuid")

    expect(entry.search).toEqual({mode: "outcome"})
    const resource = entry.resource
    expect(resource?.resourceType).toBe("OperationOutcome")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const operationOutcome = resource as {issue: Array<any>}

    expect(resource?.id).toBe("outcome-uuid")

    expect(resource?.meta).toEqual({lastUpdated: FIXED_DATE.toISOString()})
    expect(operationOutcome.issue).toHaveLength(1)
    const issue = operationOutcome.issue[0]

    expect(issue.code).toBe("business-rule")
    expect(issue.severity).toBe("warning")
    expect(issue.details).toEqual({
      coding: [
        {
          system: "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
          code: "INVALIDATED_RESOURCE",
          display: "Invalidated resource"
        }
      ]
    })

    // With Math.random mocked to 0, the shortFormId will be all 'A's
    const expectedShortForm = "AAAAAA-AAAAAA-AAAAAA"
    expect(issue.diagnostics).toBe(
      `Prescription with short form ID ${expectedShortForm} has been invalidated so could not be returned.`
    )
  })
})
