import {jest} from "@jest/globals"

// Mock @aws-sdk/client-ssm to prevent real AWS calls during tests
jest.unstable_mockModule("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn(() => Promise.resolve({Parameter: {Value: ""}}))
  })),
  GetParameterCommand: jest.fn(),
  GetParametersCommand: jest.fn(),
  PutParameterCommand: jest.fn(),
  paginateGetParametersByPath: jest.fn()
}))
