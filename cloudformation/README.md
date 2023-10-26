This folder contains cloudformation definitions for 'manually' created resources that are only created once per environment. These need to manually applied as they are not created as part of a CI or pull request build.

To bootstrap an account, you should run through the following in order

- [CI Resources](#ci-resources)
- [Account Resources](#account-resources)
- [Route 53 resources - environment accounts](#route-53-resources---environment-accounts)
- [Route 53 resources - management account](#route-53-resources---management-account)
- Run the script in privateCA folder to create mutual TLS keys

# Linting

You can run this from the root directory

```
make lint-cloudformation
```

to run [cfn-lint](https://github.com/aws-cloudformation/cfn-lint) against the cloudformation files. This is also run as a pre-commit hook and as part of the CI build

# CI Resources

ci_resources.yml contains resources that are needed for the CI pipeline to work. This should be applied to each environment.  
It creates the following resources

- OIDC provider allowing github to assume a role in the account
- Cloudformation deploy role - github runners assume this role
- Cloudformation execution role - cloudformation uses this role when applying a changeset. This has minimum permissions so if a new resource type is added, the permissions will need modifying
- Artifact bucket and KMS key - resources used by CI build are uploaded to this bucket
- Trust store bucket and KMS key - public CA certs used for mutual TLS are uploaded to this bucket
- Splunk delivery stream bucket and KMS key - cloudwatch logs that can be delivered to splunk are put in here
- Audit logging bucket - s3 access logs from artifact, trust store and splunk delivery stream buckets are sent to here
- Secrets and KMS key - there are various secrets created for storing keys used in mutual TLS. These have a default value set, but the values are modified when creating new keys.
- - CAKeySecret - used to store the private CA key
- - CACertSecret - used to store the public CA cert
- - ClientKeySecret - used to store the private client key
- - ClientCertSecret - used to store the public client cert

The stack deployed in each environment must be called `ci-resources` as the deployment pipeline gets the bucket and cloudformation execution role from the stack as part of its processing.

To deploy the stack, use the following. Note the SubjectClaimFilters can be used to grant access to multiple repos. Before deploying you should check current values to ensure that they are retained.

```
make aws-login
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>

# get current stack parameter
aws cloudformation describe-stacks \
    --stack-name ci-resources \
    --query "Stacks[0].Parameters[?ParameterKey=='SubjectClaimFilters'].ParameterValue"

# change param to output from above
aws cloudformation deploy \
          --template-file cloudformation/ci_resources.yml \
          --stack-name ci-resources \
          --region eu-west-2 \
          --capabilities CAPABILITY_IAM \
          --parameter-overrides SubjectClaimFilters="repo:NHSDigital/prescriptionsforpatients:*,repo:NHSDigital/electronic-prescription-service-release-notes:*"
```

Once this is deployed, you should get the ARN for the role `ci-resources:CloudFormationDeployRole` using this command

```
aws cloudformation list-exports \
    --query 'Exports[?Name==`ci-resources:CloudFormationDeployRole`].Value' --output text
```

This value should then be stored in the github project as a repository secret called `<ENVIRONMENT>_CLOUD_FORMATION_DEPLOY_ROLE`

# Account Resources

account_resources.yml contains resources that are account wide. This should be applied to each environment, and should be deployed before the app.

It creates the following resources

- API Gateway account role with logging permissions
- Cloudwatch Logs Resource Policy
- KMS Key for Cloudwatch (API GW) logging

The stack deployed in each environment must be called `account-resources` as the main app deployment imports the KMS key arn.

To deploy the stack, use the following

```
make aws-login
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>

aws cloudformation deploy \
          --template-file cloudformation/account_resources.yml \
          --stack-name account-resources \
          --region eu-west-2 \
          --capabilities CAPABILITY_IAM
```

# Route 53 resources - environment accounts

environment_route53.yml contains route 53 resources created in each environment account.  
It creates the following resources

- route 53 hosted zone for {environment}.prescriptionsforpatients.national.nhs.uk

It outputs the following as exports as they are used in SAM deployments

- route53-resources:ZoneID - zoneID of zone created
- route53-resources:domain - domain name of the hosted zone

To deploy the stack, use the following

```
make aws-login
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>

aws cloudformation deploy \
          --template-file cloudformation/environment_route53.yml \
          --stack-name route53-resources \
          --region eu-west-2 \
          --parameter-overrides environment=<ENVIRONMENT>
```

On bootstrap or major changes, you should get the name server host names for the created zone and update the file management_route53.yml and deploy it

# Route 53 resources - management account

management_route53.yml contains route 53 resources created in the management account. This should only be applied to the management account.  
It creates the following resources

- route 53 hosted zone for prescriptionsforpatients.national.nhs.uk
- NS records for {dev, int, ref, qa, prod}.prescriptionsforpatients.national.nhs.uk pointing to route 53 hosted zones in each account

To deploy the stack, use the following

```
make aws-login
export AWS_PROFILE=prescription-management

aws cloudformation deploy \
          --template-file cloudformation/management_route53.yml \
          --stack-name route53-resources \
          --region eu-west-2
```
