import {expect, describe, it} from "@jest/globals"
import {
  Address,
  Bundle,
  ContactPoint,
  Organization
} from "fhir/r4"
import {DistanceSelling, Entry, ServicesCache} from "../src/distanceSelling"
import {mockPharmacy2uResponse} from "@prescriptionsforpatients_common/testing"
import MockAdapter from "axios-mock-adapter"
import axios from "axios"
import {Logger} from "@aws-lambda-powertools/logger"

const mock = new MockAdapter(axios)

function getOrganisation(): Organization {
  return {
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
  }
}

describe("ServiceSearch tests", function () {
  const logger = new Logger({serviceName: "distanceSelling"})
  beforeEach(() => {
    process.env.TargetServiceSearchServer = "live"
    mock.reset()
  })

  it("addToTelecom does exactly that while maintaining the address", async () => {
    const distanceSelling = new DistanceSelling({}, logger)
    const organisation = getOrganisation()

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
    const organisation = getOrganisation()

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
      resourceType: "Organization",
      id: "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
      identifier: [{
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: "FLM49"
      }],
      name: "Social Care Site - HEALTH AND CARE AT HOME",
      address: [{
        use: "work",
        type: "both",
        line: [
          "THE HEALTH AND WELLBEING INNOVATION C",
          "TRELISKE"
        ],
        city: "TRURO",
        district: "CORNWALL",
        postalCode: "TR1 3FF"
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
    const organisation = getOrganisation()

    const expectedTelecom: ContactPoint = {use: "work", system: "url", value: "www.pharmacy2u.co.uk"}

    await distanceSelling.search([organisation])

    expect(organisation.address).toBeDefined()
    expect(organisation.telecom![1]).toEqual(expectedTelecom)
  })

  it("processOdsCode doesn't call service search when cache entry exists for ODS code", async () => {
    const cache: Record<string, string> = {"flm49": "www.pharmacy2u.co.uk"}
    const distanceSellingWithCache = new DistanceSelling(cache, logger)
    const organisation = getOrganisation()
    await distanceSellingWithCache.search([organisation])

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
    const organisation = getOrganisation()

    const odsCode = "flm49"
    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeTruthy()
    expect(servicesCache[odsCode]).toEqual("www.pharmacy2u.co.uk")
  })

  it("searchOdsCode adds empty item to cache when no url returned by service search", async () => {
    mock.onGet("https://live/service-search").reply(200, {value: []})
    const servicesCache: ServicesCache = {}
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const organisation = getOrganisation()

    const odsCode = "flm49"
    await distanceSelling.searchOdsCode(odsCode, organisation)

    expect(odsCode in servicesCache).toBeTruthy()
    expect(servicesCache[odsCode]).toEqual(undefined)
  })

  it("searchOdsCode does not add to cache when service search error", async () => {
    mock.onGet("https://live/service-search").networkError()
    const servicesCache: ServicesCache = {}
    const distanceSelling = new DistanceSelling(servicesCache, logger)
    const organisation = getOrganisation()

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
})
