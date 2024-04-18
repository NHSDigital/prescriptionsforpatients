import {StatusUpdates} from "../../../src/statusUpdates"

export function simpleStatusUpdates(): StatusUpdates {
  return {
    schemaVersion: 1,
    isSuccess: true,
    prescriptions: [
      {
        onboarded: true,
        prescriptionID: "727066-A83008-2EFE36",
        items: [
          {
            isTerminalState: "false",
            itemId: "e76812cf-c893-42ff-ab02-b19ea1fa11b4",
            lastUpdateDateTime: "2023-09-11T10:11:12.000Z",
            latestStatus: "Ready to Collect"
          }
        ]
      }
    ]
  }
}
