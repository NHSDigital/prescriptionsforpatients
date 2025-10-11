import {SSMProvider} from "@aws-lambda-powertools/parameters/ssm"

const defaultSsmProvider = new SSMProvider()

export class PfPConfig {
  static readonly TC007_NHS_NUMBERS_PARAM = "/pfp-TC007-NHS-Number"
  static readonly TC008_NHS_NUMBERS_PARAM = "/pfp-TC008-NHS-Number"
  static readonly TC009_NHS_NUMBERS_PARAM = "/pfp-TC009-NHS-Number"

  private ssmProvider: SSMProvider

  constructor(ssmProvider?: SSMProvider) {
    this.ssmProvider = ssmProvider || defaultSsmProvider
  }

  async isTC008(nhsNumber: string) {
    // AEA-5653, AEA-5853 | TC008: force internal error response for supplier testing
    const env = process.env["DEPLOYMENT_ENVIRONMENT"]

    if (env === "prod") return false
    const stackName = process.env.STACK_NAME || "pfp"
    const TC008_NHS_NUMBERS = await this.ssmProvider.get(`/${stackName}-TC008-NHS-Number`)
    return TC008_NHS_NUMBERS ? TC008_NHS_NUMBERS.includes(nhsNumber) : false
  }
}

// Default instance for convenience
export const pfpConfig = new PfPConfig()
