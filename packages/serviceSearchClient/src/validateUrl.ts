import {Logger} from "@aws-lambda-powertools/logger"

export function validateUrl(url: string | undefined, logger: Logger): boolean {
  if (url === undefined || url === null) {
    logger.warn("url not passed in")
    return false
  }

  const urlRegex = /^(https?):\/\/[^\s/$.?#].[^\s]*\/?([^\s/?#]+\/?)?\??([^\s&]+=[^\s&]+(&[^\s&]+=[^\s&]+)*)?$/

  return urlRegex.test(url)
}
