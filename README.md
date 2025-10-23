# Prescriptions API

![Build](https://github.com/NHSDigital/prescriptionsforpatients/actions/workflows/ci.yml/badge.svg?branch=main)
![Release](https://github.com/NHSDigital/prescriptionsforpatients/actions/workflows/release.yml/badge.svg?branch=main)  

## Versions and deployments

Version release history can be found ot <https://github.com/NHSDigital/prescriptionsforpatients/releases>.
We use eslint convention for commit messages for commits to main branch. Descriptions for the types of changes in a release can be found in the [contributing guidelines](./CONTRIBUTING.md).   
Deployment history can be found at <https://nhsdigital.github.io/prescriptionsforpatients/>

## Introduction

This is the AWS layer that provides an API for accessing prescription information for a patient.  
It is called by an Apigee proxy that is defined at <https://github.com/NHSDigital/prescriptions-for-patients>

- `packages/getMyPrescriptions/` Get prescription details for /Bundle endpoint.
- `packages/enrichPrescriptions/` Get prescription status updates for prescriptions retrieved by getMyPrescriptions.
- `packages/nhsd-pfp-sandbox/` Returns [static data](./packages/nhsd-pfp-sandbox/examples/GetMyPrescriptions/Bundle/success.json) from the Sandbox.
- `packages/statusLambda/` Returns the status of the getMyPrescriptions endpoint.
- `packages/capabilityStatement/` Returns a static capability statement.
- `packages/serviceSearchClient/` Module for connecting to service search.
- `packages/distanceSelling/` Module for using Service Search client and enriching the data being returned.
- `packages/common/utilities` Module containing commonly referenced functions, data types and configuration data.
- `packages/common/testing` Module that contains some test data used for tests in other modules.
- `postman/` Contains a postman collection for interacting with the API.
- `scripts/` Utilities helpful to developers of this specification.
- `cloudformation/` Contains cloudformation files used to create resources for CI builds and deployments.
- `SAMtemplates/` Contains the SAM templates used to define the stacks.
- `privateCA/` Contains script to create self signed CA certificate and a client certificate used for mutual TLS.
- `.github` Contains github workflows that are used for building and deploying from pull requests and releases.
- `.devcontainer` Contains a dockerfile and vscode devcontainer definition.
- `.vscode` Contains vscode workspace file.
- `.releaserc` semantic-release config file

Consumers of the API will find developer documentation on the [NHS Digital Developer Hub](https://digital.nhs.uk/developer/api-catalogue).

## Contributing

Contributions to this project are welcome from anyone, providing that they conform to the [guidelines for contribution](https://github.com/NHSDigital/prescriptionsforpatients/blob/main/CONTRIBUTING.md) and the [community code of conduct](https://github.com/NHSDigital/prescriptionsforpatients/blob/main/CODE_OF_CONDUCT.md).

### Licensing

This code is dual licensed under the MIT license and the OGL (Open Government License). Any new work added to this repository must conform to the conditions of these licenses. In particular this means that this project may not depend on GPL-licensed or AGPL-licensed libraries, as these would violate the terms of those libraries' licenses.

The contents of this repository are protected by Crown Copyright (C).

## Development

It is recommended that you use visual studio code and a devcontainer as this will install all necessary components and correct versions of tools and languages.  
See <https://code.visualstudio.com/docs/devcontainers/containers> for details on how to set this up on your host machine.  
There is also a workspace file in .vscode that should be opened once you have started the devcontainer. The workspace file can also be opened outside of a devcontainer if you wish.  
The project uses [SAM](https://aws.amazon.com/serverless/sam/) to develop and deploy the APIs and associated resources.

All commits must be made using [signed commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)

Once the steps at the link above have been completed. Add to your ~/.gnupg/gpg.conf as below:

```bash
use-agent
pinentry-mode loopback
```

and to your ~/.gnupg/gpg-agent.conf as below:

```bash
allow-loopback-pinentry
```

As described here:
<https://stackoverflow.com/a/59170001>

You will need to create the files, if they do not already exist.
This will ensure that your VSCode bash terminal prompts you for your GPG key password.

You can cache the gpg key passphrase by following instructions at <https://superuser.com/questions/624343/keep-gnupg-credentials-cached-for-entire-user-session>

### SAM setup and usage

[SAM](https://aws.amazon.com/serverless/sam/) allows rapid local development and deployment to AWS for development and testing.

### Setup

Ensure you have the following lines in the file .envrc

```bash
export AWS_DEFAULT_PROFILE=prescription-dev
export stack_name=<UNIQUE_NAME_FOR_YOU>
export TARGET_SPINE_SERVER=<NAME OF DEV TARGET SPINE SERVER> or 'sandbox' to stub the request
export TARGET_SERVICE_SEARCH_SERVER=<NAME OF DEV TARGET SERVICE SEARCH SERVER>
```

UNIQUE_NAME_FOR_YOU should be a unique name for you with no underscores in it - eg anthony-brown-1

Once you have saved .envrc, start a new terminal in vscode and run this command to authenticate against AWS

```bash
make aws-configure
```

Put the following values in:

```text
SSO session name (Recommended): sso-session
SSO start URL [None]: <USE VALUE OF SSO START URL FROM AWS LOGIN COMMAND LINE ACCESS INSTRUCTIONS ACCESSED FROM https://myapps.microsoft.com>
SSO region [None]: eu-west-2
SSO registration scopes [sso:account:access]:
```

This will then open a browser window and you should authenticate with your hscic credentials
You should then select the development account and set default region to be eu-west-2.

You will now be able to use AWS and SAM CLI commands to access the dev account. You can also use the AWS extension to view resources.

When the token expires, you may need to reauthorise using `make aws-login`

### CI Setup

The GitHub Actions require a secret to exist on the repo called "SONAR_TOKEN".
This can be obtained from [SonarCloud](https://sonarcloud.io/)
as described [here](https://docs.sonarsource.com/sonarqube/latest/user-guide/user-account/generating-and-using-tokens/).
You will need the "Execute Analysis" permission for the project (NHSDigital_prescriptionsforpatients) in order for the token to work.

### GitHub Packages Setup

To work with the GitHub Package Registry, you need to generate a [personal access token (classic)](https://docs.github.com/en/enterprise-cloud@latest/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#personal-access-tokens-classic) with appropriate permissions.

Follow these steps:

- [Generate a personal access token (classic)](https://docs.github.com/en/enterprise-cloud@latest/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic)
  - Go to your GitHub account settings and navigate to "Developer settings" > "Personal access tokens". Select the "Tokens(classic)" from the left bar.
  - Click on the "Generate a personal access token" link and select the `read:packages` scope. Ensure the token has no expiration.

- [Authorize a personal access token for use with SAML single sign-on](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on)
  - Click "Configure SSO". If you don't see this option, ensure that you have authenticated at least once through your SAML IdP to access resources on GitHub.com
  - In the dropdown menu, to the right of the organization you'd like to authorize the token for, click "Authorize".

- [Authenticating with a personal access token in to npm](https://docs.github.com/en/enterprise-cloud@latest/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token)
  - To authenticate with npm, use the following command, replacing `USERNAME` with your GitHub username, `TOKEN` with your personal access token (classic), and `PUBLIC-EMAIL-ADDRESS` with your email address.

```bash
$ npm login --scope=@NHSDigital --auth-type=legacy --registry=https://npm.pkg.github.com
> Username: USERNAME
> Password: TOKEN
```

### Continuous deployment for testing

You can run the following command to deploy the code to AWS for testing

```bash
make sam-sync
```

This will take a few minutes to deploy - you will see something like this when deployment finishes

```text
......
CloudFormation events from stack operations (refresh every 0.5 seconds)
---------------------------------------------------------------------------------------------------------------------------------------------------------------------
ResourceStatus                            ResourceType                              LogicalResourceId                         ResourceStatusReason
---------------------------------------------------------------------------------------------------------------------------------------------------------------------
.....
CREATE_IN_PROGRESS                        AWS::ApiGatewayV2::ApiMapping             HttpApiGatewayApiMapping                  -
CREATE_IN_PROGRESS                        AWS::ApiGatewayV2::ApiMapping             HttpApiGatewayApiMapping                  Resource creation Initiated
CREATE_COMPLETE                           AWS::ApiGatewayV2::ApiMapping             HttpApiGatewayApiMapping                  -
CREATE_COMPLETE                           AWS::CloudFormation::Stack                ab-1                                      -
---------------------------------------------------------------------------------------------------------------------------------------------------------------------


Stack creation succeeded. Sync infra completed.
```

Note - the command will keep running and should not be stopped.
You can now call this api - note getMyPrescriptions requires an nhsd-nhslogin-user header

```bash
curl --header "nhsd-nhslogin-user: P9:9446041481" https://${stack_name}.dev.prescriptionsforpatients.national.nhs.uk/Bundle
```

You can also use the AWS vscode extension to invoke the API or lambda directly

Any code changes you make are automatically uploaded to AWS while `make sam-sync` is running allowing you to quickly test any changes you make

### Pre-commit hooks

Some pre-commit hooks are installed as part of the install above, to run basic lint checks and ensure you can't accidentally commit invalid changes.
The pre-commit hook uses python package pre-commit and is configured in the file .pre-commit-config.yaml.
A combination of these checks are also run in CI.

### Make commands

There are `make` commands that are run as part of the CI pipeline and help alias some functionality during development.

#### install targets

- `install-node` installs node dependencies
- `install-python` installs python dependencies
- `install-hooks` installs git pre commit hooks
- `install` runs all install targets

#### SAM targets

These are used to do common commands

- `sam-build` prepares the lambdas and SAM definition file to be used in subsequent steps
- `sam-run-local` run the API and lambdas locally
- `sam-sync` sync the API and lambda to AWS. This keeps running and automatically uploads any changes to lambda code made locally. Needs AWS_DEFAULT_PROFILE, stack_name, TARGET_SERVICE_SEARCH_SERVER and TARGET_SPINE_SERVER environment variables set.
- `sam-sync-sandbox` sync the API and lambda to AWS. This keeps running and automatically uploads any changes to lambda code made locally. Needs stack_name environment variables set, the path and file name where the AWS SAM template is located.
- `sam-deploy` deploys the compiled SAM template from sam-build to AWS. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-delete` deletes the deployed SAM cloud formation stack and associated resources. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-endpoints` lists endpoints created for the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-resources` lists resources created for the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-outputs` lists outputs from the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-validate` validates the main SAM template and the splunk firehose template.
- `sam-validate-sandbox` validates the sandbox SAM template and the splunk firehose template.
- `sam-deploy-package` deploys a package created by sam-build. Used in CI builds. Needs the following environment variables set
  - artifact_bucket - bucket where uploaded packaged files are
  - artifact_bucket_prefix - prefix in bucket of where uploaded packaged files ore
  - stack_name - name of stack to deploy
  - template_file - name of template file created by sam-package
  - cloud_formation_execution_role - ARN of role that cloud formation assumes when applying the changeset

#### Download secrets

- `download-get-secrets-layer` creates the necessary directory structure and downloads the `get-secrets-layer.zip` artifact from NHSDigital's `electronic-prescription-service-get-secrets` releases

#### Clean and deep-clean targets

- `clean` clears up any files that have been generated by building or testing locally.
- `deep-clean` runs clean target and also removes any node_modules and python libraries installed locally.

#### Linting and testing

- `lint` runs lint for all code
- `lint-node` runs lint for node code
- `lint-cloudformation` runs lint for cloudformation templates
- `lint-samtemplates` runs lint for SAM templates
- `test` runs unit tests for all code
- `cfn-guard` runs cfn-guard for sam and cloudformation templates

#### Compiling

- `compile` compiles all code
- `compile-node` runs tsc to compile typescript code

#### Check licenses

- `check-licenses` checks licenses for all packages used - calls check-licenses-node, check-licenses-python, check-licenses-golang
- `check-licenses-node` checks licenses for all node code
- `check-licenses-python` checks licenses for all python code

#### CLI Login to AWS

- `aws-configure` configures a connection to AWS
- `aws-login` reconnects to AWS from a previously configured connection

### Github folder

This .github folder contains workflows and templates related to github

- `pull_request_template.yml`: Template for pull requests.

Workflows are in the .github/workflows folder

- `ci.yml` Workflow run when code merged to main. Deploys to dev and qa environments.
- `combine-dependabot-prs.yml`: Workflow for combining dependabot pull requests. Runs on demand
- `delete_old_cloudformation_stacks.yml`: Workflow for deleting old cloud formation stacks. Runs daily
- `pull_request.yml`: Called when pull request is opened or updated. Calls sam_package_code and sam_release_code to build and deploy the code. Deploys to dev AWS account. The main and sandbox stacks deployed have PR-<PULL_REQUEST_ID> in the name
- `release.yml`: Runs on demand to create a release and deploy to all environments.
- `sam_package_code.yml`: Packages code and uploads to a github artifact for later deployment
- `sam_release_code.yml`: Release code built by sam_package_code.yml to an environment
- `pr-link.yaml`: This workflow template links Pull Requests to Jira tickets and runs when a pull request is opened.
- `dependabot.yml`: Dependabot definition file

### Github pages

Github pages is used to display deployment information. The source for github pages is in the gh-pages branch.
As part of the ci and release workflows, the release tag (either the short commit SHA or release tag) is appended to `_data/{environment}_deployments.csv` so we have a history of releases and replaced in `_data/{environment}_latest.csv` so we now what the latest released version is.
There are different makefile targets in this branch. These are

- `run-jekyll` - runs the site locally so changes can be previewed during development
- `sync-main` - syncs common files from main branch to gh-pages branch. You must commit and push after running this
- `install-python` installs python dependencies
- `install-hooks` installs git pre commit hooks
- `install-node` installs node dependencies
- `install-jekyll` installs dependencies to be able to run jekyll locally
- `install` runs all install targets
