import {expect, describe, it} from "@jest/globals"
import {
  Address,
  Bundle,
  ContactPoint,
  Organization
} from "fhir/r4"
import {DistanceSelling, ServicesCache} from "../src/distanceSelling"
import {mockInteractionResponseBody, mockServiceSearchResponseBody} from "@prescriptionsforpatients_common/testing"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)
const mockBundleString = JSON.stringify(mockInteractionResponseBody)

describe("ServiceSearch tests", function () {
  const logger = new Logger({serviceName: "distanceSelling"})
  beforeEach(() => {
    process.env.TargetServiceSearchServer = "live"
    mock.reset()
  })

  it("isolatePrescriptions returns prescription resources", async () => {
    expect(mockInteractionResponseBody.entry.length).toEqual(4)
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const result = distanceSelling.isolatePrescriptions(searchsetBundle)

    expect(result.length).toEqual(2)
    expect(result.filter((r) =>
      r.resourceType === "Bundle"
    ).length).toEqual(2)
  })

  it("getPerformerReferences returns performer references from prescription resources", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const result = distanceSelling.getPerformerReferences(prescriptions)

    const expectedPerformers = new Set<string>()
    expectedPerformers.add("urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1")

    expect(result).toEqual(expectedPerformers)
  })

  it("getPerformerOrganisations returns relevant organisations", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const result = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)

    const expectedOrganisations: Array<Organization> = [
      {
        resourceType: "Organization",
        id: "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
        identifier: [
          {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: "FLM49"
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

  it("addToTelecom does exactly that while maintaining the address", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "https://url.com"}
    const expectedAddress: Address = {
      city: "TRURO",
      district: "CORNWALL",
      line: [
        "THE HEALTH AND WELLBEING INNOVATION C",
        "TRELISKE"
      ],
      postalCode: "TR1 3FF",
      type: "both",
      use: "work"
    }

    distanceSelling.addToTelecom("https://url.com", organisation)

    expect(organisation.telecom!.length).toEqual(2)
    expect(organisation.telecom![1]).toEqual(expectedTelecom)

    expect(organisation.address!.length).toEqual(1)
    expect(organisation.address![0]).toEqual(expectedAddress)
  })

  it("addToTelecom handles absence of existing telecom", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const organisation: Organization = {
      "resourceType": "Organization",
      "id": "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
      "identifier": [{
        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
        "value": "FLM49"
      }],
      "name": "Social Care Site - HEALTH AND CARE AT HOME",
      "address": [{
        "use": "work",
        "type": "both",
        "line": [
          "THE HEALTH AND WELLBEING INNOVATION C",
          "TRELISKE"
        ],
        "city": "TRURO",
        "district": "CORNWALL",
        "postalCode": "TR1 3FF"
      }]
    }

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "https://url.com"}

    distanceSelling.addToTelecom("https://url.com", organisation)

    expect(organisation.telecom).toBeDefined()
    expect(organisation.telecom![0]).toEqual(expectedTelecom)
  })

  it("processOdsCodes uses returned value in telecom", async () => {
    mock.onGet("https://live/service-search").reply(200, mockServiceSearchResponseBody)
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisations = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "www.pharmacy2u.co.uk/"}

    await distanceSelling.processOdsCodes(organisations)

    const organisation: Organization = organisations[0]
    expect(organisation.address).toBeDefined()
    expect(organisation.telecom![1]).toEqual(expectedTelecom)
  })

  it("processOdsCode doesn't call service search when cache entry exists for ODS code", async () => {
    const distanceSellingWithCache = new DistanceSelling({"flm49": "https://www.pharmacy2u.co.uk/"}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSellingWithCache.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSellingWithCache.getPerformerReferences(prescriptions)
    const organisations = distanceSellingWithCache.getPerformerOrganisations(performerReferences, prescriptions)

    await distanceSellingWithCache.processOdsCodes(organisations)

    expect(mock.history.get.length).toEqual(0)
  })

  it("searchOdsCode adds empty item to cache when no url returned by service search", async () => {
    mock.onGet("https://live/service-search").reply(200, {value: []})
    const servicesCache: ServicesCache = {}
    const odsCode = "flm49"
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeTruthy()
    expect(servicesCache[odsCode]).toEqual(undefined)
  })
})
