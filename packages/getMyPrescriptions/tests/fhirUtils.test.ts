/* eslint-disable max-len */

import "jest"
import {Bundle, Organization} from "fhir/r4"

import {mockInteractionResponseBody} from "@prescriptionsforpatients_common/testing"

import {
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
    expect(mockInteractionResponseBody.entry.length).toEqual(5)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const result = isolatePrescriptions(searchsetBundle)

    expect(result.length).toEqual(3)
    result.forEach(r => expect(r.resourceType === "Bundle"))
  })

  it("isolateMedicationRequests returns medication request resources", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = isolatePrescriptions(searchsetBundle)
    const result = prescriptions.flatMap(p => isolateMedicationRequests(p))

    expect(result.length).toEqual(6)
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
      "urn:uuid:154dcc4a-0006-4272-9758-9dcb8d95ce8b"
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
      pharmicaOrganisation()
    ]

    expect(result.length).toEqual(2)
    expect(result).toEqual(expectedOrganisations)
  })

  it("isolatePerformerOrganisations returns relevant organisations when same organisation across prescriptions", async () => {
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle
    const pharmicaPrescription = searchsetBundle.entry![2].resource! as Bundle
    pharmicaPrescription.entry![4].resource! = pharmacy2uOrganisation()

    const result = isolatePerformerOrganisations(searchsetBundle)

    const expectedOrganisations: Array<Organization> = [
      pharmacy2uOrganisation(),
      pharmacy2uOrganisation()
    ]

    expect(result.length).toEqual(2)
    expect(result).toEqual(expectedOrganisations)
  })
})
