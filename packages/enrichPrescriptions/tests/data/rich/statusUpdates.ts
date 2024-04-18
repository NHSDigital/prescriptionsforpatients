import {StatusUpdates} from "../../../src/statusUpdates"

export function richStatusUpdates(): StatusUpdates {
  return {
    schemaVersion: 1,
    isSuccess: true,
    prescriptions: [
      {
        onboarded: true,
        prescriptionID: "24F5DA-A83008-7EFE6Z",
        items: [
          {
            isTerminalState: "false",
            itemId: "a54219b8-f741-4c47-b662-e4f8dfa49ab6",
            lastUpdateDateTime: "2023-09-11T10:11:12.000Z",
            latestStatus: "Prescriber Approved"
          },
          {
            isTerminalState: "true",
            itemId: "6989b7bd-8db6-428c-a593-4022e3044c00",
            lastUpdateDateTime: "2023-09-11T10:11:13.000Z",
            latestStatus: "Prescriber Cancelled"
          },
          {
            isTerminalState: "false",
            itemId: "2868554c-5565-4d31-b92a-c5b8dab8b90a",
            lastUpdateDateTime: "2023-09-11T10:11:14.000Z",
            latestStatus: "With Pharmacy"
          },
          {
            isTerminalState: "false",
            itemId: "5cb17f5a-11ac-4e18-825f-6470467238b3",
            lastUpdateDateTime: "2023-09-11T10:11:15.000Z",
            latestStatus: "With Pharmacy - Preparing Remainder"
          }
        ]
      },
      {
        onboarded: true,
        prescriptionID: "566946-B86044-FEFEFN",
        items: [
          {
            isTerminalState: "false",
            itemId: "ee035711-7aac-48c4-951a-62c07891d37d",
            lastUpdateDateTime: "2023-09-11T10:11:16.000Z",
            latestStatus: "Ready to Collect"
          }
        ]
      },
      {
        onboarded: true,
        prescriptionID: "16B2E0-A83008-81C13H",
        items: [
          {
            isTerminalState: "false",
            itemId: "b6bf7869-9b30-436c-9260-84fc3dbf449b",
            lastUpdateDateTime: "2023-09-11T10:11:17.000Z",
            latestStatus: "Ready to Collect - Partial"
          }
        ]
      }
    ]
  }
}
