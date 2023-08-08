This folder contains cloudformation definitions for 'manually' created resources that are only created once per environment. These need to manually applied as they are not created as part of a CI or pull request build.

To bootstrap an account, you should run through the following in order

- [CI Resources](#ci-resources)
- [Route 53 resources - environment accounts](#route-53-resources---environment-accounts)
- [Route 53 resources - management account](#route-53-resources---management-account)
- [VPC Resources](#vpc-resources)
- Run the script in privateCA folder to create mutual TLS keys

# CI Resources

ci_resources.yml contains resources that are needed for the CI pipeline to work. This should be applied to each environment.  
It creates the following resources

- OIDC provider allowing github to assume a role in the account
- Cloudformation deploy role - github runners assume this role
- Cloudformation execution role - cloudformation uses this role when applying a changeset. This has minimum permissions so if a new resource type is added, the permissions will need modifying
- Artifact bucket and KMS key - resources used by CI build are uploaded to this bucket
- Trust store bucket and KMS key - public CA certs used for mutual TLS are uploaded to this bucket
- Secrets and KMS key - there are various secrets created for storing keys used in mutual TLS. These have a default value set, but the values are modified when creating new keys.
- - CAKeySecret - used to store the private CA key
- - CACertSecret - used to store the public CA cert
- - ClientKeySecret - used to store the private client key
- - ClientCertSecret - used to store the public client cert

The stack deployed in each environment must be called `ci-resources` as the deployment pipeline gets the bucket and cloudformation execution role from the stack as part of its processing.

To deploy the stack, use the following

```
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>
aws sso login --sso-session sso-session

aws cloudformation deploy \
          --template-file cloudformation/ci_resources.yml \
          --stack-name ci-resources \
          --region eu-west-2 \
          --capabilities CAPABILITY_IAM
```

Once this is deployed, you should get the ARN for the role `ci-resources:CloudFormationDeployRole` using this command

```
aws cloudformation list-exports \
    --query 'Exports[?Name==`ci-resources:CloudFormationDeployRole`].Value' --output text
```

This value should then be stored in the github project as a repository secret called `<ENVIRONMENT>_CLOUD_FORMATION_DEPLOY_ROLE`

# Route 53 resources - environment accounts

environment_route53.yml contains route 53 resources created in each environment account.  
It creates the following resources

- route 53 hosted zone for {environment}.prescriptionsforpatients.national.nhs.uk

It outputs the following as exports as they are used in SAM deployments

- route53-resources:ZoneID - zoneID of zone created
- route53-resources:domain - domain name of the hosted zone

To deploy the stack, use the following

```
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>
aws sso login --sso-session sso-session

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
export AWS_PROFILE=prescription-management
aws sso login --sso-session sso-session

aws cloudformation deploy \
          --template-file cloudformation/management_route53.yml \
          --stack-name route53-resources \
          --region eu-west-2
```

# VPC Resources

This creates VPC resources that provide static outbound IP addresses from lambdas to allow the static IP addresses to be added to an allow list on the target servers.  
For more details about how this works see https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/generate-a-static-outbound-ip-address-using-a-lambda-function-amazon-vpc-and-a-serverless-architecture.html  
This should be applied in each environment.  
It creates the following resources

- a VPC
- an internet gateway attacthed to the VPC
- public subnets for 3 availability zones
- private subnets for 3 availability zones
- elastic IP address for each of 3 availability zones
- NAT gateway for 3 availability zones with attached elastic IP address
- route tables for the 3 public subnets with a route to internet gateway
- route tables for the 3 private subnets with a route to each NAT gateway

It outputs the following

- subnetId for each of the private subnets
- default security group for the VPC

To deploy the stack, use the following

```
export AWS_PROFILE=<name of AWS profile defined in ~/.aws/config>
aws sso login --sso-session sso-session

aws cloudformation deploy \
          --template-file cloudformation/vpc_resources.yml \
          --stack-name vpc-resources \
          --region eu-west-2
```

To use this for a lambda, you must add the following.  
In the role properties, you must add this policy document. This must be on the role and not a policy attached to the role

```
      Policies:
        - PolicyName: FunctionPolicy
          PolicyDocument:
            Version: 2012-10-17
            Statement:
              - Effect: Allow
                Action:
                  - "ec2:CreateNetworkInterface"
                  - "ec2:DescribeNetworkInterfaces"
                  - "ec2:DeleteNetworkInterface"
                Resource: "*"
```

In the properties of the AWS::Serverless::Function you must add the following

```
      VpcConfig:
        SecurityGroupIds:
          - !ImportValue vpc-resources:DefaultSecurityGroup
        SubnetIds:
          - !ImportValue vpc-resources:PrivateSubnetA
          - !ImportValue vpc-resources:PrivateSubnetB
          - !ImportValue vpc-resources:PrivateSubnetC
```
