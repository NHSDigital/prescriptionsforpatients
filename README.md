# Prescriptions API

![Build](https://github.com/NHSDigital/prescriptionsforpatients/workflows/release/badge.svg?branch=main)

This is the AWS layer that provides an API for accessing prescription information for a patient.  
It is called by an Apigee proxy that is defined at https://github.com/NHSDigital/prescriptions-for-patients

- `packages/getMyPrescriptions/` Get prescription details for /Bundle endpoint.
- `packages/splunkProcessor/` Processes CloudWatch logs for Splunk.
- `packages/sandbox/` Returns [static data](./packages/sandbox/examples/GetMyPrescriptions/Bundle/success.json) from the Sandbox
- `packages/middleware/` A modified [middy-error-handler](https://github.com/schibsted/middy-error-handler) to return FHIR responses
- `packages/statusLambda/` Returns the status of the getMyPrescriptions endpoint
- `packages/capabilityStatement/` Returns a static capability statement
- `packages/getSecretLayer/` golang code that is used as a lambda layer to inject secrets to environment variables used by lambdas
- `packages/spineClient/` Module for connecting to spine
- `packages/common/testing` Module that contains some test data used for tests in other modules
- `postman/` Contains a postman collection for interacting with the API.
- `scripts/` Utilities helpful to developers of this specification.
- `cloudformation/` Contains cloudformation files used to create resources for CI builds and deployments
- `privateCA/` Contains script to create self signed CA certificate and a client certificate used for mutual TLS
- `.github` Contains github workflows that are used for building and deploying from pull requests and releases
- `.devcontainer` Contains a dockerfile and vscode devcontainer definition
- `.vscode` Contains vscode workspace file

Consumers of the API will find developer documentation on the [NHS Digital Developer Hub](https://digital.nhs.uk/developer/api-catalogue).

## Contributing

Contributions to this project are welcome from anyone, providing that they conform to the [guidelines for contribution](https://github.com/NHSDigital/prescriptionsforpatients/blob/main/CONTRIBUTING.md) and the [community code of conduct](https://github.com/NHSDigital/prescriptionsforpatients/blob/main/CODE_OF_CONDUCT.md).

### Licensing

This code is dual licensed under the MIT license and the OGL (Open Government License). Any new work added to this repository must conform to the conditions of these licenses. In particular this means that this project may not depend on GPL-licensed or AGPL-licensed libraries, as these would violate the terms of those libraries' licenses.

The contents of this repository are protected by Crown Copyright (C).

## Development

It is recommended that you use visual studio code and a devcontainer as this will install all necessary components and correct versions of tools and languages.  
See https://code.visualstudio.com/docs/devcontainers/containers for details on how to set this up on your host machine.  
There is also a workspace file in .vscode that should be opened once you have started the devcontainer. The workspace file can also be opened outside of a devcontainer if you wish.  
The project uses [SAM](https://aws.amazon.com/serverless/sam/) to develop and deploy the APIs and associated resources.

All commits must be made using [signed commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)

Once the steps at the link above have been completed. Add to your ~/.gnupg/gpg.conf as below:

```
use-agent
pinentry-mode loopback
```

and to your ~/.gnupg/gpg-agent.conf as below:

```
allow-loopback-pinentry
```

As described here:
https://stackoverflow.com/a/59170001

You will need to create the files, if they do not already exist.
This will ensure that your VSCode bash terminal prompts you for your GPG key password.

### SAM setup and usage

[SAM](https://aws.amazon.com/serverless/sam/) allows rapid local development and deployment to AWS for development and testing.

### Setup

Ensure you have the following lines in the file .envrc

```
export AWS_DEFAULT_PROFILE=prescription-dev
export stack_name=<UNIQUE_NAME_FOR_YOU>
```

UNIQUE_NAME_FOR_YOU should be a unique name for you with no underscores in it - eg anthony-brown-1

Once you have saved .envrc, start a new terminal in vscode and run this command to authenticate against AWS

```
make aws-configure
```

Put the following values in:

```
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

### Continuos deployment for testing

You can run the following command to deploy the code to AWS for testing

```
make sam-sync
```

This will take a few minutes to deploy - you will see something like this when deployment finishes

```
CloudFormation outputs from deployed stack
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Outputs
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Key                 GetMyPrescriptionsFunctionIamRole
Description         Implicit IAM Role created for the GetMyPrescriptions function
Value               arn:aws:iam::591291862413:role/anthony-brown-1-GetMyPrescriptionsRole-11UP8H33K2UPT

Key                 PrescriptionApi
Description         API Gateway endpoint URL for Prod stage for the Main function
Value               https://juzzbrgm97.execute-api.eu-west-2.amazonaws.com/Prod/

Key                 GetMyPrescriptionsFunction
Description         GetMyPrescriptions Lambda Function ARN
Value               arn:aws:lambda:eu-west-2:591291862413:function:anthony-brown-1-GetMyPrescriptions-cLwkpIBkBDNN
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


Stack update succeeded. Sync infra completed.
```

Note - the command will keep running and should not be stopped.
You can call the api using the prescription API from the output - eg

```
curl https://juzzbrgm97.execute-api.eu-west-2.amazonaws.com/Prod/getMyPrescriptions
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
- `sam-sync` sync the API and lambda to AWS. This keeps running and automatically uploads any changes to lambda code made locally. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-sync-sandbox` sync the API and lambda to AWS. This keeps running and automatically uploads any changes to lambda code made locally. Needs stack_name environment variables set, the path and file name where the AWS SAM template is located.
- `sam-deploy` deploys the compiled SAM template from sam-build to AWS. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-delete` deletes the deployed SAM cloud formation stack and associated resources. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-endpoints` lists endpoints created for the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-resources` lists resources created for the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-list-outputs` lists outputs from the current stack. Needs AWS_DEFAULT_PROFILE and stack_name environment variables set.
- `sam-validate` validates the SAM template.
- `sam-deploy-package` deploys a package created by sam-build. Used in CI builds. Needs the following environment variables set
  - artifact_bucket - bucket where uploaded packaged files are
  - artifact_bucket_prefix - prefix in bucket of where uploaded packaged files ore
  - stack_name - name of stack to deploy
  - template_file - name of template file created by sam-package
  - cloud_formation_execution_role - ARN of role that cloud formation assumes when applying the changeset

#### Clean and deep-clean targets

- `clean` clears up any files that have been generated by building or testing locally.
- `deep-clean` runs clean target and also removes any node_modules and python libraries installed locally.

#### Linting and testing

- `lint` runs lint for all code
- `lint-node` runs lint for node code
- `lint-go` runs lint for golang code
- `test` runs unit tests for all code

#### Compiling

- `compile` compiles all code
- `compile-node` runs tsc to compile typescript code
- `compile-go` compiles golang binary

#### Check licenses

- `check-licenses` checks licenses for all packages used - calls check-licenses-node, check-licenses-python, check-licenses-golang
- `check-licenses-node` checks licenses for all node code
- `check-licenses-python` checks licenses for all python code
- `check-licenses-go` checks licenses for all golang code

#### CLI Login to AWS

- `aws-configure` configures a connection to AWS
- `aws-login` reconnects to AWS from a previously configured connection

### Github folder

This .github folder contains workflows and templates related to github

- `pull_request_template.yml`: Template for pull requests.

Workflows are in the .github/workflows folder

- `combine-dependabot-prs.yml`: Workflow for combining dependabot pull requests. Runs on demand
- `delete_old_cloudformation_stacks.yml`: Workflow for deleting old cloud formation stacks. Runs daily
- `pull_request.yml`: Called when pull request is opened or updated. Calls sam_package_code and sam_release_code to build and deploy the code. Deploys to dev AWS account. The main and sandbox stacks deployed have PR-<PULL_REQUEST_ID> in the name
- `quality_checks.yml`: Runs check-licenses, lint, test and sonarcloud scan against the repo. Called from pull_request.yml and release.yml
- `release.yml`: Run when code is merged to main branch or a tag starting v is pushed. Calls sam_package_code and sam_release_code to build and deploy the code.
- `sam_package_code.yml`: Packages code and uploads to a github artifact for later deployment
- `sam_release_code.yml`: Release code built by sam_package_code.yml to an environment
- `pr-link.yaml`: This workflow template links Pull Requests to Jira tickets and runs when a pull request is opened.
- `dependabot.yml`: Dependabot definition file
