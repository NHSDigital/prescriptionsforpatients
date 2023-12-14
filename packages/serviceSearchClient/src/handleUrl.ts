import {Logger} from "@aws-lambda-powertools/logger"

export function handleUrl(urlString: string, odsCode: string, logger: Logger): URL | undefined {
  let url: URL
  try {
    url = new URL(urlString)
  } catch (error) {
    if (error instanceof TypeError) {
      logger.info(`url ${urlString} for service with ODS code ${odsCode} is invalid - ${error}`)
    } else {
      logger.error(`error parsing url ${urlString} for service with ODS code ${odsCode} - ${error}`)
    }
    return undefined
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    logger.info(`url ${url.toString()} for service with ODS code ${odsCode} has invalid protocol ${url.protocol}`)
    return undefined
  }

  return url
}
