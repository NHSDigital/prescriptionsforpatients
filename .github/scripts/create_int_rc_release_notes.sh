#!/usr/bin/env bash

cat <<EOF > payload.json
{ 
  "currentTag": "$CURRENT_DEPLOYED_TAG",
  "targetTag": "$RELEASE_TAG",
  "repoName": "prescriptionsforpatients",
  "targetEnvironment": "INT",
  "productName": "Prescriptions for Patients AWS layer",
  "releaseNotesPageId": "710051481",
  "releaseNotesPageTitle": "PfP-AWS-$RELEASE_TAG - Deployed to [INT] on $(date +'%d-%m-%y')",
  "createReleaseCandidate": "true",
  "releasePrefix": "PfP-AWS-"
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
