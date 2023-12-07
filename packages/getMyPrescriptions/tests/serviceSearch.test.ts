import {expect, describe, it} from "@jest/globals"
import {Bundle, ContactPoint, Organization} from "fhir/r4"
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

  it("getPerformerOrganisations returns relevant organisations", async () => {
    const serviceSearch = new ServiceSearch()
    const searchsetBundle = mockInteractionResponseBody as Bundle

    const prescriptions = serviceSearch.isolatePrescriptions(searchsetBundle)
    const performerReferences = serviceSearch.getPerformerReferences(prescriptions)
    const result = serviceSearch.getPerformerOrganisations(performerReferences, prescriptions)

    const expectedOrganisations: Array<Organization> = [
      {
        resourceType: "Organization",
        id: "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
        identifier: [
          {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: "VNE51"
          }
        ],
        name: "Social Care Site - HEALTH AND CARE AT HOME",
        telecom: [
          {
            system: "phone",
            use: "work",
            value: "0115 9999999"
          }
        ],
        address: [
          {
            use: "work",
            type: "both",
            line: [
              "THE HEALTH AND WELLBEING INNOVATION C",
              "TRELISKE"
            ],
            city: "TRURO",
            district: "CORNWALL",
            postalCode: "TR1 3FF"
          }
        ]
      }
    ]
    expect(result).toEqual(expectedOrganisations)
  })

  it("replaceAddressWithTelecom does exactly that", async () => {
    const serviceSearch = new ServiceSearch()
    const searchsetBundle = mockInteractionResponseBody as Bundle

    const prescriptions = serviceSearch.isolatePrescriptions(searchsetBundle)
    const performerReferences = serviceSearch.getPerformerReferences(prescriptions)
    const organisation = serviceSearch.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "https://url.com"}

    serviceSearch.replaceAddressWithTelecom("https://url.com", organisation)

    expect(organisation.telecom!.length).toEqual(2)
    expect(organisation.telecom![1]).toEqual(expectedTelecom)
    expect(organisation.address).toBeUndefined()
  })
})
