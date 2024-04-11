/* eslint-disable max-len */

import "jest"
import {buildStatusUpdateData} from "../src/statusUpdate"
import {mockInteractionResponseBody} from "@prescriptionsforpatients_common/testing"
import {Bundle, FhirResource} from "fhir/r4"

describe("Unit tests for statusUpdate", () => {
  test("when a bundle is passed-in, expected status update data is returned for prescriptions with performers", async () => {
    const bundle = mockInteractionResponseBody as Bundle<FhirResource>
    const result = buildStatusUpdateData(bundle)
    expect(result).toEqual([
      {
        odsCode: "FLM49",
        prescriptionID: "24F5DA-A83008-7EFE6Z"
      },
      {
        odsCode: "FEW08",
        prescriptionID: "16B2E0-A83008-81C13H"
      }
    ])
  })
})
