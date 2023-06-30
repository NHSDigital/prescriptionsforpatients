import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda"
import {Logger, injectLambdaContext} from "@aws-lambda-powertools/logger"
import middy from "@middy/core"
import inputOutputLogger from "@middy/input-output-logger"
import errorHandler from "@middleware/src"
import axios from "axios"

const logger = new Logger({serviceName: "getMyPrescriptions"})

const getToken = async () => {
  const clientId = process.env.CLIENT_ID
  const clientSecret = process.env.CLIENT_SECRET
  const redirectUri = "https://example.org/callback"
  const grantType = "authorization_code"

  try {
    const response = await axios.post("https://identity-service.example.com/token", {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: grantType
    })

    if (response.status !== 200) {
      throw new Error("Unable to get token")
    }

    return response.data
  } catch (error) {
    console.error("Error fetching access token:", error)
    return null
  }
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const targetSpineServer = process.env.TargetSpineServer
  logger.info(`hello world from getMyPrescriptions logger - target spine server ${targetSpineServer}`)

  const returnType = event.queryStringParameters?.returnType
  logger.info({message: "value of returnType", returnType})

  let nhsNumber: string | undefined

  switch (returnType) {
    case "teapot": {
      return {
        statusCode: 418,
        body: JSON.stringify({
          message: "I am a teapot short and stout"
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
    }
    case "error": {
      throw Error("error running lambda")
    }
    default: {
      const token = await getToken()

      if (token) {
        try {
          const response = await axios.get("https://internal-dev.api.service.nhs.uk/prescriptions-for-patients-pr-7", {
            headers: {
              Authorization: `Bearer ${token.access_token}`
            }
          })

          const nhsNumberHeader = response.headers["nhsd-nhslogin-user"]
          const [identityProofingLevel, obtainedNhsNumber] = nhsNumberHeader.split(":")
          nhsNumber = obtainedNhsNumber

          console.log("Identity Proofing Level:", identityProofingLevel)
          console.log("NHS Number:", nhsNumber)
        } catch (error) {
          console.error("Error fetching NHS number:", error)
        }
      } else {
        console.log("Failed to fetch access token")
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `hello world from getMyPrescriptions lambda - ${nhsNumber}`
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
    }
  }
}

export const handler = middy(lambdaHandler)
  .use(injectLambdaContext(logger))
  .use(
    inputOutputLogger({
      logger: (request) => {
        logger.info(request)
      }
    })
  )
  .use(errorHandler({logger}))
