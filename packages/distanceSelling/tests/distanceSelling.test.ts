import {expect, describe, it} from "@jest/globals"
import {
  Address,
  Bundle,
  ContactPoint,
  Organization
} from "fhir/r4"
import {DistanceSelling, Entry, ServicesCache} from "../src/distanceSelling"
import {mockInteractionResponseBody, mockPharmacy2uResponse} from "@prescriptionsforpatients_common/testing"
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
    expect(mockInteractionResponseBody.entry.length).toEqual(5)
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const result = distanceSelling.isolatePrescriptions(searchsetBundle)

    expect(result.length).toEqual(3)
    expect(result.filter((r) =>
      r.resourceType === "Bundle"
    ).length).toEqual(3)
  })

  it("getPerformerReferences returns performer references from prescription resources", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const result = distanceSelling.getPerformerReferences(prescriptions)

    const expectedPerformers = new Set<string>()
    expectedPerformers.add("urn:uuid:afb07f8b-e8d7-4cad-895d-494e6b35b2a1")
    expectedPerformers.add("urn:uuid:154dcc4a-0006-4272-9758-9dcb8d95ce8b")

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
        name: "Pharmacy2u",
        telecom: [
          {
            system: "phone",
            use: "work",
            value: "0113 2650222"
          }
        ],
        address: [
          {
            use: "work",
            type: "both",
            line: [
              "Unit 4B",
              "Victoria Road"
            ],
            city: "LEEDS",
            district: "WEST YORKSHIRE",
            postalCode: "LS14 2LA"
          }
        ]
      },
      {
        resourceType: "Organization",
        id: "154dcc4a-0006-4272-9758-9dcb8d95ce8b",
        identifier: [
          {
            system: "https://fhir.nhs.uk/Id/ods-organization-code",
            value: "FEW08"
          }
        ],
        name: "Pharmica",
        telecom: [
          {
            system: "phone",
            use: "work",
            value: "020 71129014"
          }
        ],
        address: [
          {
            use: "work",
            type: "both",
            line: [
              "1-5 Clerkenwell Road"
            ],
            city: "LONDON",
            district: "GREATER LONDON",
            postalCode: "EC1M 5PA"
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

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "www.pharmacy2u.co.uk"}
    const expectedAddress: Address = {
      use: "work",
      type: "both",
      line: [
        "Unit 4B",
        "Victoria Road"
      ],
      city: "LEEDS",
      district: "WEST YORKSHIRE",
      postalCode: "LS14 2LA"
    }

    distanceSelling.addToTelecom("www.pharmacy2u.co.uk", organisation)

    expect(organisation.telecom!.length).toEqual(2)
    expect(organisation.telecom![1]).toEqual(expectedTelecom)

    expect(organisation.address!.length).toEqual(1)
    expect(organisation.address![0]).toEqual(expectedAddress)
  })

  it("addToTelecom does does not add multiple url entries", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const expectedUrl: ContactPoint = {use: "work", system: "url", value: "www.pharmacy2u.co.uk"}
    const expectedTelephone: ContactPoint = {use: "work", system: "phone", value: "0113 2650222"}

    distanceSelling.addToTelecom("www.pharmacy2u.co.uk", organisation)
    distanceSelling.addToTelecom("www.pharmacy2u.co.uk", organisation)

    expect(organisation.telecom!.length).toEqual(2)
    expect(organisation.telecom![0]).toEqual(expectedTelephone)
    expect(organisation.telecom![1]).toEqual(expectedUrl)
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
    mock.onGet("https://live/service-search").reply(200, mockPharmacy2uResponse)
    const distanceSelling = new DistanceSelling({}, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisations = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "www.pharmacy2u.co.uk"}

    await distanceSelling.processOdsCodes(organisations)

    const organisation: Organization = organisations[0]
    // The address is removed, since we're a distance selling pharmacy
    expect(organisation.address).toBeUndefined()
    expect(organisation.telecom![1]).toEqual(expectedTelecom)
  })

  it("processOdsCode doesn't call service search when cache entry exists for ODS code", async () => {
    const cache: Record<string, string> = {"flm49": "www.pharmacy2u.co.uk", "few08": "www.pharmica.co.uk"}
    const distanceSellingWithCache = new DistanceSelling(cache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    await distanceSellingWithCache.search(searchsetBundle)

    expect(mock.history.get.length).toEqual(0)
  })

  it.each<{urlString: string}>([
    {
      urlString: "https://www.pharmacy2u.co.uk/"
    },
    {
      urlString: "https://www.pharmacy2u.co.uk/".replace("s", "")
    },
    {
      urlString: "https://www.pharmacy2u.co.uk"
    }
  ])("getUrlString removes protocol and trailing slash before adding to cache", async ({urlString}) => {
    const distanceSelling = new DistanceSelling({}, logger)
    const result = distanceSelling.getUrlString(new URL(urlString))

    expect(result).toEqual("www.pharmacy2u.co.uk")
  })

  it("searchOdsCode adds item to cache when url returned by service search", async () => {
    mock.onGet("https://live/service-search").reply(200, mockPharmacy2uResponse)
    const servicesCache: ServicesCache = {}
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const odsCode = "flm49"
    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeTruthy()
    expect(servicesCache[odsCode]).toEqual("www.pharmacy2u.co.uk")
  })

  it("searchOdsCode adds empty item to cache when no url returned by service search", async () => {
    mock.onGet("https://live/service-search").reply(200, {value: []})
    const servicesCache: ServicesCache = {}
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const odsCode = "flm49"
    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeTruthy()
    expect(servicesCache[odsCode]).toEqual(undefined)
  })

  it("searchOdsCode does not add to cache when service search error", async () => {
    mock.onGet("https://live/service-search").networkError()
    const servicesCache: ServicesCache = {}
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisation = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)[0]

    const odsCode = "flm49"
    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeFalsy()
  })

  it("filterAndTypeBundleEntries will return empty array when no entries present", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const bundle: Bundle = {type: "collection", resourceType: "Bundle"}

    const filter = (entry: Entry) => entry.resource!.resourceType === "Organization"
    const result = distanceSelling.filterAndTypeBundleEntries<Organization>(bundle, filter)

    expect(result).toEqual([])
  })

  it("processOdsCodes removes address and adds telecom when cache entry exists for ODS codes", async () => {
  // Pre‐populate cache with both ODS codes
    const cache: ServicesCache = {
      flm49: "www.pharmacy2u.co.uk",
      few08: "www.pharmica.co.uk"
    }
    const distanceSelling = new DistanceSelling(cache, logger)
    const searchsetBundle = JSON.parse(mockBundleString) as Bundle

    // organizations to process
    const prescriptions = distanceSelling.isolatePrescriptions(searchsetBundle)
    const performerReferences = distanceSelling.getPerformerReferences(prescriptions)
    const organisations = distanceSelling.getPerformerOrganisations(performerReferences, prescriptions)

    // Run the cache‐hit branch
    await distanceSelling.processOdsCodes(organisations)

    organisations.forEach((org) => {
      expect(org.address).toBeUndefined()
    })
    const org1Url = organisations[0].telecom?.find(t => t.system === "url")?.value
    const org2Url = organisations[1].telecom?.find(t => t.system === "url")?.value
    expect(org1Url).toEqual("www.pharmacy2u.co.uk")
    expect(org2Url).toEqual("www.pharmica.co.uk")
  })
})
