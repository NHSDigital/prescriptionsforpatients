This folder contains a cloudformation definition that is used to create the resources in an AWS account for CI processes to work.  
It creates the following resources

- OIDC provider allowing github to assume a role in the account
- Cloudformation deploy role - github runners assume this role
- Cloudformation execution role - cloudformation uses this role when applying a changeset
- Artifact bucket and KMS key - resources used by CI build are uploaded to this bucket

The stack deployed in each environment must be called `ci-resources` as the deployment pipeline gets the bucket and cloudformation execution role from the stack as part of its processing.

To deploy the stack, use the following

```
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>
aws sso login --sso-session sso-session

aws cloudformation deploy \
          --template-file cloudformation/ci_resources.yaml \
          --stack-name ci-resources \
          --region eu-west-2 \
          --capabilities CAPABILITY_IAM
```
