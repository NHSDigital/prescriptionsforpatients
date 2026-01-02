import type {EventHeaders} from "./types"

export class NHSNumberValidationError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NHSNumberValidationError.prototype)
  }
}

export function extractNHSNumberFromHeaders(headers: EventHeaders): string {
  if (headers["nhs-login-identity-proofing-level"]) {
    // Proxygen spec will include proofing level header, whereas non-proxygen API will not
    return validateNHSNumber(headers["nhsd-nhslogin-user"]!)
  } else {
    return extractNHSNumber(headers["nhsd-nhslogin-user"])
  }
}

export function extractNHSNumber(nhsloginUser: string | undefined): string {
  // This function is only relevant for non-proxygen API which prepends proofing level
  // to the front of the nhs number ie. P9:1234567890
  if (nhsloginUser === undefined || nhsloginUser === null) {
    throw new NHSNumberValidationError("nhsdloginUser not passed in")
  }
  let nhsNumber = nhsloginUser.split(":")[1]
  const authLevel = nhsloginUser.split(":")[0]
  if (nhsNumber === undefined || nhsNumber === null || isNaN(Number(nhsNumber)) || nhsNumber.toString().length !== 10) {
    throw new NHSNumberValidationError("NHS Number failed preflight checks")
  }

  if (authLevel !== "P9") {
    throw new NHSNumberValidationError("Identity proofing level is not P9")
  }
  return validateNHSNumber(nhsNumber)
}

export function validateNHSNumber(nhsNumber: string): string {
  // convert numbers to strings, for internal consistency
  if (Number.isInteger(nhsNumber)) {
    nhsNumber = nhsNumber.toString()
  }

  // Step 1: Multiply each of the first 9 numbers by (11 - position indexed from 1)
  // Step 2: Add the results together
  // Step 3: Divide the total by 11 to get the remainder
  const nhsNumberAsArray: Array<string> = nhsNumber.split("")
  const remainder = nhsNumberAsArray.slice(0, 9).map(multiplyByPosition).reduce(addTogether, 0) % 11

  let checkDigit = 11 - remainder

  // replace 11 for 0
  if (checkDigit === 11) {
    checkDigit = 0
  }

  const providedCheckDigit = nhsNumberAsArray[9]

  // Do the check digits match?
  if (checkDigit !== Number(providedCheckDigit)) {
    throw new NHSNumberValidationError(`Invalid check digit in NHS number ${nhsNumber}`)
  }
  return nhsNumber
}

function multiplyByPosition(digit: string, index: number) {
  // multiple each digit by 11  minus its position (indexed from 1)
  return parseInt(digit) * (11 - (index + 1))
}

function addTogether(previousValue: number, currentValue: number) {
  return previousValue + currentValue
}
