#!/usr/bin/env bash

echo "$COMMIT_ID"

CF_LONDON_EXPORTS=$(aws cloudformation list-exports --region eu-west-2 --output json)

artifact_bucket=$(echo "$CF_LONDON_EXPORTS" | \
    jq \
    --arg EXPORT_NAME "account-resources-cdk-uk:Bucket:ArtifactsBucket:Arn" \
    -r '.Exports[] | select(.Name == $EXPORT_NAME) | .Value')
artifact_bucket_name=$(echo "${artifact_bucket}" | cut -d ":" -f 6)

cloud_formation_execution_role=$(echo "$CF_LONDON_EXPORTS" | \
    jq \
    --arg EXPORT_NAME "iam-cdk:IAM:CloudFormationExecutionRole:Arn" \
    -r '.Exports[] | select(.Name == $EXPORT_NAME) | .Value')
TRUSTSTORE_BUCKET_ARN=$(echo "$CF_LONDON_EXPORTS" | \
    jq \
    --arg EXPORT_NAME "account-resources-cdk-uk:Bucket:TrustStoreBucket:Arn" \
    -r '.Exports[] | select(.Name == $EXPORT_NAME) | .Value')

export artifact_bucket
export cloud_formation_execution_role

TRUSTSTORE_BUCKET_NAME=$(echo "${TRUSTSTORE_BUCKET_ARN}" | cut -d ":" -f 6)
LATEST_TRUSTSTORE_VERSION=$(aws s3api list-object-versions --bucket "${TRUSTSTORE_BUCKET_NAME}" --prefix "${TRUSTSTORE_FILE}" --query 'Versions[?IsLatest].[VersionId]' --output text)
export LATEST_TRUSTSTORE_VERSION

cd ../../.aws-sam/build || exit

REPO=prescriptionsforpatients
CFN_DRIFT_DETECTION_GROUP="pfp"
if [[ "$STACK_NAME" =~ -pr-[0-9]+$ ]]; then
  CFN_DRIFT_DETECTION_GROUP="pfp-pull-request"
fi

IS_PULL_REQUEST=${IS_PULL_REQUEST:-false}

sam deploy \
  --template-file "$TEMPLATE_FILE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --region eu-west-2 \
  --s3-bucket "$artifact_bucket_name" \
  --s3-prefix "$ARTIFACT_BUCKET_PREFIX" \
  --config-file samconfig_package_and_deploy.toml \
  --no-fail-on-empty-changeset \
  --role-arn "$cloud_formation_execution_role" \
  --no-confirm-changeset \
  --force-upload \
  --tags "version=$VERSION_NUMBER stack=$STACK_NAME repo=$REPO cfnDriftDetectionGroup=$CFN_DRIFT_DETECTION_GROUP" \
  --parameter-overrides \
      TruststoreVersion="$LATEST_TRUSTSTORE_VERSION" \
      TruststoreFile="$TRUSTSTORE_FILE" \
      EnableMutualTLS="$ENABLE_MUTUAL_TLS" \
      TargetSpineServer="$TARGET_SPINE_SERVER" \
      TargetServiceSearchServer="$TARGET_SERVICE_SEARCH_SERVER" \
      EnableSplunk=true \
      VersionNumber="$VERSION_NUMBER" \
      CommitId="$COMMIT_ID" \
      LogLevel="$LOG_LEVEL" \
      LogRetentionInDays="$LOG_RETENTION_DAYS" \
      IsPullRequest="$IS_PULL_REQUEST" \
      Env="$TARGET_ENVIRONMENT" \
      ToggleGetStatusUpdates="$TOGGLE_GET_STATUS_UPDATES" \
      EnableAlerts="$ENABLE_ALERTS" \
      StateMachineLogLevel="$STATE_MACHINE_LOG_LEVEL" \
      ForwardCsocLogs="$FORWARD_CSOC_LOGS" \
      TC007NHSNumberValue="$TC007_NHS_NUMBERS" \
      TC008NHSNumberValue="$TC008_NHS_NUMBERS" \
      TC009NHSNumberValue="$TC009_NHS_NUMBERS" \
      AllowNHSNumberOverride="$ALLOW_NHS_NUMBER_OVERRIDE"
