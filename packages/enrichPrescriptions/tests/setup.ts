import {vi} from "vitest"

// Mock @aws-sdk/client-ssm to prevent real AWS calls during tests
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(() => ({
    send: vi.fn(() => Promise.resolve({Parameter: {Value: ""}}))
  })),
  GetParameterCommand: vi.fn(),
  GetParametersCommand: vi.fn(),
  PutParameterCommand: vi.fn(),
  paginateGetParametersByPath: vi.fn()
}))

vi.mock("@aws-lambda-powertools/parameters/ssm", () => ({
  SSMProvider: vi.fn(() => ({
    get: vi.fn(async () => "")
  }))
}))
