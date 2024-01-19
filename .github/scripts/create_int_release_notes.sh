#!/usr/bin/env bash

cat <<EOF > payload.json
{ 
  "currentTag": "$CURRENT_DEPLOYED_TAG", 
  "targetTag": "$DEV_TAG", 
  "repoName": "prescriptionsforpatients", 
  "targetEnvironment": "INT", 
  "productName": "Prescriptions for Patients AWS layer", 
  "releaseNotesPageId": "693750027", 
  "releaseNotesPageTitle": "Current PfP AWS layer release notes - INT"
}
EOF
cat payload.json

if [ "$DRY_RUN" != "true" ]; then
  function_arn=$(aws cloudformation list-exports --query "Exports[?Name=='release-notes:CreateReleaseNotesLambdaArn'].Value" --output text)
  aws lambda invoke --function-name "${function_arn}" \
  --cli-binary-format raw-in-base64-out \
  --payload file://payload.json out.txt
  cat out.txt
fi
