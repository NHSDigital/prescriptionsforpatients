import {SSMProvider} from "@aws-lambda-powertools/parameters/ssm"
import {Logger} from "@aws-lambda-powertools/logger"

const defaultSsmProvider = new SSMProvider({
  clientConfig: {region: process.env.AWS_REGION || "eu-west-2"}
})

export class PfPConfig {
  static readonly TC007_NHS_NUMBERS_PARAM = "TC007NHSNumber"
  static readonly TC008_NHS_NUMBERS_PARAM = "TC008NHSNumber"
  static readonly TC009_NHS_NUMBERS_PARAM = "TC009NHSNumber"

  private readonly ssmProvider: SSMProvider
  private readonly logger: Logger

  constructor(ssmProvider?: SSMProvider) {
    this.logger = new Logger()
    this.ssmProvider = ssmProvider || defaultSsmProvider
  }

  async isTestCase(nhsNumber: string, param: string) {
    const env = process.env["DEPLOYMENT_ENVIRONMENT"]
    if (env === "prod") return false

    try {
      const stackName = process.env.STACK_NAME || "pfp"
      const paramValue = await this.ssmProvider.get(`/${stackName}-${param}`)
      return paramValue ? paramValue.includes(nhsNumber) : false
    } catch (error) {
      this.logger.warn(`Cannot read parameter ${param}, continue with test case disabled:`, {error})
      return false
    }
  }

  async isTC007(nhsNumber: string) {
    // TC007: test case functionality for supplier testing
    return this.isTestCase(nhsNumber, PfPConfig.TC007_NHS_NUMBERS_PARAM)
  }

  async isTC008(nhsNumber: string) {
    // AEA-5653, AEA-5853 | TC008: force internal error response for supplier testing
    return this.isTestCase(nhsNumber, PfPConfig.TC008_NHS_NUMBERS_PARAM)
  }

  async isTC009(nhsNumber: string) {
    // TC009: test case functionality for supplier testing
    return this.isTestCase(nhsNumber, PfPConfig.TC009_NHS_NUMBERS_PARAM)
  }
}

// Default instance for convenience
export const pfpConfig = new PfPConfig()
