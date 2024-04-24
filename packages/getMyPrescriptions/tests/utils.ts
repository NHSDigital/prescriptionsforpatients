import {jest} from "@jest/globals"
import {Organization} from "fhir/r4"

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

export function pharmacy2uOrganisation(): Organization {
  return {
    resourceType: "Organization",
    id: "afb07f8b-e8d7-4cad-895d-494e6b35b2a1",
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: "FLM49"
      }
    ],
    name: "Pharmacy2u",
    telecom: [
      {
        system: "phone",
        use: "work",
        value: "0113 2650222"
      }
    ],
    address: [
      {
        use: "work",
        type: "both",
        line: [
          "Unit 4B",
          "Victoria Road"
        ],
        city: "LEEDS",
        district: "WEST YORKSHIRE",
        postalCode: "LS14 2LA"
      }
    ]
  }
}

export function pharmicaOrganisation(): Organization {
  return {
    resourceType: "Organization",
    id: "154dcc4a-0006-4272-9758-9dcb8d95ce8b",
    identifier: [
      {
        system: "https://fhir.nhs.uk/Id/ods-organization-code",
        value: "FEW08"
      }
    ],
    name: "Pharmica",
    telecom: [
      {
        system: "phone",
        use: "work",
        value: "020 71129014"
      }
    ],
    address: [
      {
        use: "work",
        type: "both",
        line: [
          "1-5 Clerkenwell Road"
        ],
        city: "LONDON",
        district: "GREATER LONDON",
        postalCode: "EC1M 5PA"
      }
    ]
  }
}
