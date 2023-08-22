const transformLogEvent = require("../src/app.js")
const {expect, describe, it} = require("@jest/globals")

/* eslint-disable  max-len */

describe("transformLogEvent", () => {

  it("should parse a json log event", async () => {
    const logEvent = {
      message: JSON.stringify({
        field1: "foo",
        field2: "bar"
      }),
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:{
          field1:"foo",
          field2:"bar"
        }
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should get a function request id from string START log event", async () => {
    const logEvent = {
      message: "START RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8 Version: $LATEST",
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:{
          message:"START RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8 Version: $LATEST",
          function_request_id:"720f4d20-ffd3-4a06-924a-0a61c9c594c8"
        }
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should get a function request id from string END log event", async () => {
    const logEvent = {
      message: "END RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8",
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:{
          message:"END RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8",
          function_request_id:"720f4d20-ffd3-4a06-924a-0a61c9c594c8"
        }
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should get a function request id from string REPORT log event", async () => {
    const logEvent = {
      message: "REPORT RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8	Duration: 1006.29 ms	Billed Duration: 1000 ms	Memory Size: 256 MB	Max Memory Used: 87 MB	Init Duration: 669.74 ms",
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:{
          message: "REPORT RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8	Duration: 1006.29 ms	Billed Duration: 1000 ms	Memory Size: 256 MB	Max Memory Used: 87 MB	Init Duration: 669.74 ms",
          function_request_id:"720f4d20-ffd3-4a06-924a-0a61c9c594c8"
        }
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should get a function request id from console log event", async () => {
    const logEvent = {
      message: "2023-08-22T09:52:29.585Z 720f4d20-ffd3-4a06-924a-0a61c9c594c8 Task timed out after 1.01 seconds",
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:{
          message: "2023-08-22T09:52:29.585Z 720f4d20-ffd3-4a06-924a-0a61c9c594c8 Task timed out after 1.01 seconds",
          function_request_id:"720f4d20-ffd3-4a06-924a-0a61c9c594c8"
        }
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should not get a function request id when it is not specified", async () => {
    const logEvent = {
      message: "No new layer was specified, unsetting AWS_LAMBDA_EXEC_WRAPPER",
      id: 1
    }
    const logGroup = "/aws/lambda/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/lambda/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message: "No new layer was specified, unsetting AWS_LAMBDA_EXEC_WRAPPER"
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })

  it("should not get a function request id when log group is not lambda", async () => {
    const logEvent = {
      message: "END RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8",
      id: 1
    }
    const logGroup = "/aws/foo"
    const accountNumber = 1234
    const transformedLogEvent = await transformLogEvent(logEvent, logGroup, accountNumber)
    const expectedResult = {
      host:"AWS:AccountNumber:1234",
      source:"AWS:LogGroup:/aws/foo",
      sourcetype:"aws:cloudwatch",
      event:{
        id:1,
        message:"END RequestId: 720f4d20-ffd3-4a06-924a-0a61c9c594c8"
      }
    }

    expect(transformedLogEvent).toEqual(JSON.stringify(expectedResult))
  })
})
