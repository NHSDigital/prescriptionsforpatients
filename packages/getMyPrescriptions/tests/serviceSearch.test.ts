import {expect, describe, it} from "@jest/globals"
import {Bundle} from "fhir/r4"
import {serviceSearch} from "../src/serviceSearch"

describe("Service search", function () {
  it("returns bundle", async () => {
    const bundle: Bundle = {resourceType: "Bundle", type: "searchset"}
    const result = serviceSearch(bundle)
    expect(result).toEqual({resourceType: "Bundle", type: "searchset"})
  })
})
