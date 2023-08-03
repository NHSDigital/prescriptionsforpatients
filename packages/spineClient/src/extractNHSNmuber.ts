export function extractNHSNumber(nhsloginUser: string | undefined): string {
  if (nhsloginUser === undefined || nhsloginUser === null) {
    throw "nhsloginUser not passed in"
  }
  let nhsNumber = nhsloginUser.split(":")[1]
  const authLevel = nhsloginUser.split(":")[0]
  if (nhsNumber === undefined || nhsNumber === null || isNaN(Number(nhsNumber)) || nhsNumber.toString().length !== 10) {
    throw "NHS Number failed preflight checks"
  }

  if (authLevel !== "P9") {
    throw "Identity proofing level is not P9"
  }
  // convert numbers to strings, for internal consistency
  if (Number.isInteger(nhsNumber)) {
    nhsNumber = nhsNumber.toString()
  }

  // Step 1: Multiply each of the first 9 numbers by (11 - position indexed from 1)
  // Step 2: Add the results together
  // Step 3: Divide the total by 11 to get the remainder
  const nhsNumberAsArray: string[] = nhsNumber.split("")
  const remainder = nhsNumberAsArray.slice(0, 9).map(multiplyByPosition).reduce(addTogether, 0) % 11

  let checkDigit = 11 - remainder

  // replace 11 for 0
  if (checkDigit === 11) {
    checkDigit = 0
  }

  const providedCheckDigit = nhsNumberAsArray[9]

  // Do the check digits match?
  if (checkDigit !== Number(providedCheckDigit)) {
    throw "invalid check digit in NHS number"
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
