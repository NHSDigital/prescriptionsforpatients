/* eslint-disable max-len */

import "jest"
import {Bundle, Organization} from "fhir/r4"

import {mockInteractionResponseBody} from "@prescriptionsforpatients_common/testing"

import {
  Entry,
  filterAndTypeBundleEntries,
  isolateMedicationRequests,
  isolatePerformerOrganisation,
  isolatePerformerOrganisations,
  isolatePerformerReference,
  isolatePrescriptions
} from "../src/fhirUtils"
import {pharmacy2uOrganisation, pharmicaOrganisation} from "./utils"

const mockBundleString = JSON.stringify(mockInteractionResponseBody)

describe("Unit tests for fhirUtils", function () {
  it("isolatePrescriptions returns prescription resources", async () => {
    expect(mockInteractionResponseBody.entry.length).toEqual(6)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const result = isolatePrescriptions(searchsetBundle)

    expect(result.length).toEqual(4)
    result.forEach(r => expect(r.resourceType === "Bundle"))
  })

  it("isolateMedicationRequests returns medication request resources", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = isolatePrescriptions(searchsetBundle)
    const result = prescriptions.flatMap(p => isolateMedicationRequests(p))

    expect(result.length).toEqual(10)
    result.forEach(r => expect(r.resourceType === "MedicationRequest"))
  })

  it("isolatePerformerReference returns performer reference from medication request resource", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = isolatePrescriptions(searchsetBundle)
    const medicationRequests = prescriptions.map(p => isolateMedicationRequests(p))
    const performerReferences = medicationRequests.flatMap(m => isolatePerformerReference(m))
    const result = performerReferences.filter(p => p !== undefined)

    const expectedPerformers = [
      "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
      "urn:uuid:154dcc4a-0006-4272-9758-9dcb8d95ce8b",
      "urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1"
    ]

    expect(result).toEqual(expectedPerformers)
  })

  it("isolatePerformerOrganisation returns relevant organisation", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescription = isolatePrescriptions(searchsetBundle)[0]
    const medicationRequests = isolateMedicationRequests(prescription)
    const performerReference = isolatePerformerReference(medicationRequests)

    const result = isolatePerformerOrganisation(performerReference!, prescription)

    const expectedOrganisation: Organization = pharmacy2uOrganisation()
    expect(result).toEqual(expectedOrganisation)
  })

  it("isolatePerformerOrganisations returns relevant organisations", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const result = isolatePerformerOrganisations(searchsetBundle)

    const expectedOrganisations: Array<Organization> = [
      pharmacy2uOrganisation(),
      pharmicaOrganisation(),
      pharmacy2uOrganisation()
    ]

    expect(result.length).toEqual(3)
    expect(result).toEqual(expectedOrganisations)
  })

  it("isolatePerformerOrganisations returns relevant organisations when same organisation across prescriptions", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle
    const pharmicaPrescription = searchsetBundle.entry![3].resource! as Bundle
    pharmicaPrescription.entry![2].resource! = pharmacy2uOrganisation()

    const result = isolatePerformerOrganisations(searchsetBundle)

    const expectedOrganisations: Array<Organization> = [
      pharmacy2uOrganisation(),
      pharmicaOrganisation(),
      pharmacy2uOrganisation()
    ]

    expect(result.length).toEqual(3)
    expect(result).toEqual(expectedOrganisations)
  })

  it("filterAndTypeBundleEntries will return empty array when no entries present", async () => {
    const bundle: Bundle = {type: "collection", resourceType: "Bundle"}

    const filter = (entry: Entry) => entry.resource!.resourceType === "Organization"
    const result = filterAndTypeBundleEntries<Organization>(bundle, filter)

    expect(result).toEqual([])
  })
})
