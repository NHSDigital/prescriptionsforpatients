import {Logger} from "@aws-lambda-powertools/logger"

export function validateUrl(url: string | undefined, logger: Logger): boolean {
  if (url === undefined || url === null) {
    logger.warn("url not passed in")
    return false
  }

  // Regex validation goes here

  return true
}
