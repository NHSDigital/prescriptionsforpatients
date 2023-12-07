import {expect, describe, it} from "@jest/globals"
import {Bundle} from "fhir/r4"
import {ServiceSearch} from "../src/serviceSearch"
import {mockInteractionResponseBody} from "@prescriptionsforpatients_common/testing"

describe("ServiceSearch tests", function () {
  it("isolatePrescriptions returns prescription resources", async () => {
    expect(mockInteractionResponseBody.entry.length).toEqual(4)
    const serviceSearch = new ServiceSearch()
    const searchsetBundle = mockInteractionResponseBody as Bundle

    const result = serviceSearch.isolatePrescriptions(searchsetBundle)

    expect(result.length).toEqual(2)
    expect(result.filter((r) =>
      r.resourceType === "Bundle"
    ).length).toEqual(2)
  })

  it("getPerformerReferences returns performer references from prescription resources", async () => {
    const serviceSearch = new ServiceSearch()
    const searchsetBundle = mockInteractionResponseBody as Bundle
    const prescriptions = serviceSearch.isolatePrescriptions(searchsetBundle)
    const result = serviceSearch.getPerformerReferences(prescriptions)

    const expectedPerformers = new Set<string>()
    expectedPerformers.add("urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1")

    expect(result).toEqual(expectedPerformers)
  })

  it("getOdsCodes returns relevant ODS codes", async () => {
    const serviceSearch = new ServiceSearch()
    const searchsetBundle = mockInteractionResponseBody as Bundle
    const prescriptions = serviceSearch.isolatePrescriptions(searchsetBundle)
    const performerReferences = serviceSearch.getPerformerReferences(prescriptions)
    const result = serviceSearch.getOdsCodes(performerReferences, prescriptions)

    const expectedOdsCodes = new Set<string>()
    expectedOdsCodes.add("VNE51")

    expect(result).toEqual(expectedOdsCodes)
  })
})
