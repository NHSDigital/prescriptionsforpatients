#!/usr/bin/env bash

# shellcheck disable=SC2154

ENV_VAR=release-notes:CreateReleaseNotesLambdaName
RELEASE_NOTES_LAMBDA=$(aws cloudformation list-exports --query "Exports[?Name=='$ENV_VAR'].Value" --output text)

cat <<EOF > payload.json
{ 
  "currentTag": "$target_tag",
  "targetTag": "$dev_tag",
  "repoName": "prescriptionsforpatients",
  "targetEnvironment": "PROD",
  "productName": "Prescritpions for Patients AWS layer",
  "releaseNotesPageId": "693750029",
  "releaseNotesPageTitle": "Current PfP AWS layer release notes - PROD"
}
EOF
cat payload.json

aws lambda invoke --function-name "${RELEASE_NOTES_LAMBDA}" --cli-binary-format raw-in-base64-out --payload file://payload.json out.txt
