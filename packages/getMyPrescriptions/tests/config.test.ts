import {PfPConfig} from "../src/config"
import {SSMProvider} from "@aws-lambda-powertools/parameters/ssm"
import {
  expect,
  describe,
  it,
  jest,
  beforeEach,
  afterEach
} from "@jest/globals"

describe("PfPConfig", () => {
  const NHS_NUMBER = "1234567890"
  let originalEnv: typeof process.env
  let mockGet: jest.MockedFunction<(paramName: string) => Promise<string>>
  let pfpConfig: PfPConfig

  beforeEach(() => {
    originalEnv = {...process.env}
    // Create mock SSM provider
    mockGet = jest.fn() as jest.MockedFunction<(paramName: string) => Promise<string>>
    const mockSSMProvider = {
      get: mockGet
    } as unknown as SSMProvider
    // Create config instance with mock provider
    pfpConfig = new PfPConfig(mockSSMProvider)
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  describe("isTC008", () => {
    it("returns false if DEPLOYMENT_ENVIRONMENT is 'prod'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "prod"
      const result = await pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockGet).not.toHaveBeenCalled()
    })

    it("returns true if NHS number is in SSM param and env is 'dev'", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockGet.mockResolvedValue(`${NHS_NUMBER},other`)
      const result = await pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(true)
      expect(mockGet).toHaveBeenCalledWith("/pfp-TC008-NHS-Number")
    })

    it("returns false if NHS number is not in SSM param", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockGet.mockResolvedValue("other,numbers")
      const result = await pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
      expect(mockGet).toHaveBeenCalledWith("/pfp-TC008-NHS-Number")
    })

    it("uses STACK_NAME from env if present", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      process.env.STACK_NAME = "customstack"
      mockGet.mockResolvedValue(NHS_NUMBER)
      await pfpConfig.isTC008(NHS_NUMBER)
      expect(mockGet).toHaveBeenCalledWith("/customstack-TC008-NHS-Number")
    })

    it("returns false if SSM param is undefined", async () => {
      process.env.DEPLOYMENT_ENVIRONMENT = "dev"
      mockGet.mockResolvedValue(undefined as unknown as string)
      const result = await pfpConfig.isTC008(NHS_NUMBER)
      expect(result).toBe(false)
    })
  })
})
