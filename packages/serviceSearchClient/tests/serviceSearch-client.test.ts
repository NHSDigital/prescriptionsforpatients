import {LiveServiceSearchClient} from "../src/live-serviceSearch-client"
import {Logger} from "@aws-lambda-powertools/logger"
import {createServiceSearchClient, SandboxServiceSearchClient} from "../src/serviceSearch-client"

describe("ServiceSearchClient factory & sandbox client", () => {
  let logger: Logger

  beforeEach(() => {
    logger = new Logger({serviceName: "serviceSearchClient"})
  })

  afterEach(() => {
    delete process.env.TargetServiceSearchServer
  })

  test("defaults to LiveServiceSearchClient when TARGET not set", () => {
    delete process.env.TargetServiceSearchServer
    const client = createServiceSearchClient(logger)
    expect(client).toBeInstanceOf(LiveServiceSearchClient)
  })

  test("returns LiveServiceSearchClient when TARGET set to anything other than 'sandbox'", () => {
    process.env.TargetServiceSearchServer = "live"
    const client = createServiceSearchClient(logger)
    expect(client).toBeInstanceOf(LiveServiceSearchClient)
  })

  test("returns SandboxServiceSearchClient when TARGET set to 'sandbox'", () => {
    process.env.TargetServiceSearchServer = "sandbox"
    const client = createServiceSearchClient(logger)
    expect(client).toBeInstanceOf(SandboxServiceSearchClient)
  })

  test("SandboxServiceSearchClient.searchService always throws", async () => {
    process.env.TargetServiceSearchServer = "sandbox"
    const client = createServiceSearchClient(logger) as SandboxServiceSearchClient
    await expect(client.searchService())
      .rejects
      .toThrow("INTERACTION_NOT_SUPPORTED_BY_SANDBOX")
  })
})
