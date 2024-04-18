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

export const SERVICE_SEARCH_PARAMS = {
  "api-version": 2,
  "searchFields": "ODSCode",
  "$filter": "OrganisationTypeId eq 'PHA' and OrganisationSubType eq 'DistanceSelling'",
  "$select": "URL,OrganisationSubType",
  "$top": 1
}
