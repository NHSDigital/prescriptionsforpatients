import {Logger} from "@aws-lambda-powertools/logger"

export class UrlValidationError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, UrlValidationError.prototype)
  }
}

export function validateUrl(url: string | undefined, logger: Logger): boolean {
  if (url === undefined || url === null) {
    logger.warn("url not passed in")
    return false
  }

  // Regex validation goes here

  return true
}
