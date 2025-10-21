import {createMockedPfPConfig, setupTestEnvironment, MockedPfPConfig} from "@pfp-common/testing"
import {
  expect,
  describe,
  it,
  beforeEach,
  afterEach
} from "@jest/globals"

describe("PfPConfig", () => {
  const NHS_NUMBER = "1234567890"
  let testEnv: ReturnType<typeof setupTestEnvironment>
  let mockedConfig: MockedPfPConfig

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockedConfig = createMockedPfPConfig([NHS_NUMBER])
  })

  afterEach(() => {
    testEnv.restoreEnvironment()
  })

  describe("isTC007", () => {
    it("returns false if DEPLOYMENT_ENVIRONMENT is 'prod'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "prod"
      const result = await mockedConfig.pfpConfig.isTC007(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).not.toHaveBeenCalled()
    })

    it("returns true if NHS number is in SSM param and env is 'dev'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      const result = await mockedConfig.pfpConfig.isTC007(NHS_NUMBER)
      expect(result).toBe(true)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC007NHSNumber")
    })

    it("returns false if NHS number is not in SSM param", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue("other,numbers")
      const result = await mockedConfig.pfpConfig.isTC007(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC007NHSNumber")
    })

    it("uses STACK_NAME from env if present", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      process.env.STACK_NAME = "customstack"
      await mockedConfig.pfpConfig.isTC007(NHS_NUMBER)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/customstack-TC007NHSNumber")
    })

    it("returns false if SSM param is undefined", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue(undefined as unknown as string)
      const result = await mockedConfig.pfpConfig.isTC007(NHS_NUMBER)
      expect(result).toBe(false)
    })
  })

  describe("isTC008", () => {
    it("returns false if DEPLOYMENT_ENVIRONMENT is 'prod'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "prod"
      const result = await mockedConfig.pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).not.toHaveBeenCalled()
    })

    it("returns true if NHS number is in SSM param and env is 'dev'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      const result = await mockedConfig.pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(true)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC008NHSNumber")
    })

    it("returns false if NHS number is not in SSM param", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue("other,numbers")
      const result = await mockedConfig.pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC008NHSNumber")
    })

    it("uses STACK_NAME from env if present", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      process.env.STACK_NAME = "customstack"
      await mockedConfig.pfpConfig.isTC008(NHS_NUMBER)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/customstack-TC008NHSNumber")
    })

    it("returns false if SSM param is undefined", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue(undefined as unknown as string)
      const result = await mockedConfig.pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
    })
  })

  describe("isTC009", () => {
    it("returns false if DEPLOYMENT_ENVIRONMENT is 'prod'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "prod"
      const result = await mockedConfig.pfpConfig.isTC009(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).not.toHaveBeenCalled()
    })

    it("returns true if NHS number is in SSM param and env is 'dev'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      const result = await mockedConfig.pfpConfig.isTC009(NHS_NUMBER)
      expect(result).toBe(true)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC009NHSNumber")
    })

    it("returns false if NHS number is not in SSM param", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue("other,numbers")
      const result = await mockedConfig.pfpConfig.isTC009(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/pfp-TC009NHSNumber")
    })

    it("uses STACK_NAME from env if present", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      process.env.STACK_NAME = "customstack"
      await mockedConfig.pfpConfig.isTC009(NHS_NUMBER)
      expect(mockedConfig.mockGet).toHaveBeenCalledWith("/customstack-TC009NHSNumber")
    })

    it("returns false if SSM param is undefined", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockedConfig.mockGet.mockResolvedValue(undefined as unknown as string)
      const result = await mockedConfig.pfpConfig.isTC009(NHS_NUMBER)
      expect(result).toBe(false)
    })
  })
})
