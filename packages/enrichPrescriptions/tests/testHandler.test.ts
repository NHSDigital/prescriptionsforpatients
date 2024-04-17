import {expect, describe, it} from "@jest/globals"
import {eventWithBundleAndStatusUpdates} from "./utils"
import {eventHandler} from "../src/enrichPrescriptions"

describe("Unit test for handler", function () {
  it("when event contains a bundle and status updates, updates are applied", async () => {
    const {event, response} = eventWithBundleAndStatusUpdates()
    const actualResponse = await eventHandler(event)

    expect(actualResponse).toEqual(response)
  })
})

export {}
