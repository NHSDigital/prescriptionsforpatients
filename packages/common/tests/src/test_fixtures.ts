import {jest} from "@jest/globals"
import {PfPConfig} from "@/common/config"
import {SSMProvider} from "@aws-lambda-powertools/parameters/ssm"

export interface MockedPfPConfig {
  pfpConfig: PfPConfig
  mockGet: jest.MockedFunction<(paramName: string) => Promise<string>>
}

/**
 * Common test environment setup
 */
export function setupTestEnvironment() {
  const originalEnv = {...process.env}

  const restoreEnvironment = () => {
    process.env = originalEnv
    jest.restoreAllMocks()
  }

  return {
    originalEnv,
    restoreEnvironment
  }
}

/**
 * Creates a mocked PfPConfig that contains specific NHS numbers for testing
 * @param nhsNumbers - Array of NHS numbers that should be returned by the SSM parameter
 * @returns Object containing the mocked config and the mock function
 */
export function createMockedPfPConfig(nhsNumbers: Array<string> = []): MockedPfPConfig {
  // Create mock SSM provider
  const mockGet = jest.fn() as jest.MockedFunction<(paramName: string) => Promise<string>>

  // Set up mock to return the NHS numbers as a comma-separated string
  const nhsNumbersString = nhsNumbers.join(",")
  mockGet.mockResolvedValue(nhsNumbersString)

  const mockSSMProvider = {
    get: mockGet
  } as unknown as SSMProvider

  // Create config instance with mock provider
  const pfpConfig = new PfPConfig(mockSSMProvider)

  return {
    pfpConfig,
    mockGet
  }
}

/**
 * Example usage in tests:
 *
 * describe("My tests", () => {
 *   let testEnv: ReturnType<typeof setupTestEnvironment>
 *   let mockedConfig: MockedPfPConfig
 *
 *   beforeEach(() => {
 *     testEnv = setupTestEnvironment()
 *     mockedConfig = createMockedPfPConfig(["1234567890", "9876543210"])
 *   })
 *
 *   afterEach(() => {
 *     testEnv.restoreEnvironment()
 *   })
 *
 *   it("should test TC007/TC008/TC009 functionality", async () => {
 *     process.env.DEPLOYMENT_ENVIRONMENT = "dev"
 *     const result = await mockedConfig.pfpConfig.isTC008("1234567890")
 *     expect(result).toBe(true)
 *     expect(mockedConfig.mockGet).toHaveBeenCalled()
 *   })
 * })
 */
