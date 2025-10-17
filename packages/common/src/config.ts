import {SSMProvider} from "@aws-lambda-powertools/parameters/ssm"

const defaultSsmProvider = new SSMProvider({
  clientConfig: {region: process.env.AWS_REGION || "eu-west-2"}
})

export class PfPConfig {
  static readonly TC007_NHS_NUMBERS_PARAM = "TC007NHSNumber"
  static readonly TC008_NHS_NUMBERS_PARAM = "TC008NHSNumber"
  static readonly TC009_NHS_NUMBERS_PARAM = "TC009NHSNumber"

  private ssmProvider: SSMProvider

  constructor(ssmProvider?: SSMProvider) {
    this.ssmProvider = ssmProvider || defaultSsmProvider
  }

  async isTC007(nhsNumber: string) {
    // TC007: test case functionality for supplier testing
    const env = process.env["DEPLOYMENT_ENVIRONMENT"]

    if (env === "prod") return false
    const stackName = process.env.STACK_NAME || "pfp"
    const TC007_NHS_NUMBERS = await this.ssmProvider.get(`/${stackName}-${PfPConfig.TC007_NHS_NUMBERS_PARAM}`)
    return TC007_NHS_NUMBERS ? TC007_NHS_NUMBERS.includes(nhsNumber) : false
  }

  async isTC008(nhsNumber: string) {
    // AEA-5653, AEA-5853 | TC008: force internal error response for supplier testing
    const env = process.env["DEPLOYMENT_ENVIRONMENT"]

    if (env === "prod") return false
    const stackName = process.env.STACK_NAME || "pfp"
    const TC008_NHS_NUMBERS = await this.ssmProvider.get(`/${stackName}-${PfPConfig.TC008_NHS_NUMBERS_PARAM}`)
    return TC008_NHS_NUMBERS ? TC008_NHS_NUMBERS.includes(nhsNumber) : false
  }

  async isTC009(nhsNumber: string) {
    // TC009: test case functionality for supplier testing
    const env = process.env["DEPLOYMENT_ENVIRONMENT"]

    if (env === "prod") return false
    const stackName = process.env.STACK_NAME || "pfp"
    const TC009_NHS_NUMBERS = await this.ssmProvider.get(`/${stackName}-${PfPConfig.TC009_NHS_NUMBERS_PARAM}`)
    return TC009_NHS_NUMBERS ? TC009_NHS_NUMBERS.includes(nhsNumber) : false
  }
}

// Default instance for convenience
export const pfpConfig = new PfPConfig()
