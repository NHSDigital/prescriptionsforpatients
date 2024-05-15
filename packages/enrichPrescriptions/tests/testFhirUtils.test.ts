/* eslint-disable max-len */

import {expect, describe, it} from "@jest/globals"
import {richRequestBundle, simpleRequestBundle} from "./utils"
import {isolateMedicationRequests, isolatePrescriptions} from "../src/fhirUtils"
import {Bundle} from "fhir/r4"

describe("Unit tests for fhirUtils", function () {
  it("when given a searchset bundle, isolatePrescriptions returns prescriptions", async () => {
    const searchsetBundle = richRequestBundle()
    const result = isolatePrescriptions(searchsetBundle)

    expect(result!.length).toEqual(3)
    result!.forEach(r =>
      expect(r.resourceType).toEqual("Bundle")
    )
  })

  it("when given a prescription bundle, isolateMedicationRequests returns medication requests", async () => {
    const prescriptionBundle = simpleRequestBundle().entry![0].resource as Bundle
    const result = isolateMedicationRequests(prescriptionBundle)

    expect(result!.length).toEqual(1)
    expect(result![0].resourceType).toEqual("MedicationRequest")
  })
})
