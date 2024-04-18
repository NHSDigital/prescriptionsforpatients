/* eslint-disable max-len */

import {expect, describe, it} from "@jest/globals"
import {richEventAndResponse, simpleEventAndResponse} from "./utils"
import {eventHandler} from "../src/enrichPrescriptions"

describe("Unit tests for handler", function () {
  it("when event contains a bundle with one MedicationRequest containing one LineItem and status updates, updates are applied", async () => {
    const {event, response} = simpleEventAndResponse()
    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })

  it("when event contains a bundle with multiple MedicationRequests containing multiple LineItems and status updates, updates are applied", async () => {
    const {event, response} = richEventAndResponse()
    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })
})
