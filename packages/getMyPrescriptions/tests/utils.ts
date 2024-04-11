import {jest} from "@jest/globals"

// Uses unstable jest method to enable mocking while using ESM. To be replaced in future.
export function mockInternalDependency(modulePath: string, module: object, dependency: string) {
  const mockDependency = jest.fn()
  jest.unstable_mockModule(modulePath, () => ({
    ...module,
    [dependency]: mockDependency
  }))
  return mockDependency
}
