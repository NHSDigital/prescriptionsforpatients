#!/usr/bin/env bash

echo "calling mark jira released"
cat <<EOF > payload.json
{ 
  "releaseVersion": "PfP-AWS-$RELEASE_TAG"
}
EOF
cat payload.json

if [ "$DRY_RUN" != "true" ]; then
  function_arn=$(aws cloudformation list-exports --query "Exports[?Name=='release-notes:MarkJiraReleasedLambdaArn'].Value" --output text)
  aws lambda invoke --function-name "${function_arn}" \
  --cli-binary-format raw-in-base64-out \
  --payload file://payload.json out.txt
  cat out.txt
fi
