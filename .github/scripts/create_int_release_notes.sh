#!/usr/bin/env bash

ENV_VAR=release-notes:CreateReleaseNotesLambdaName
RELEASE_NOTES_LAMBDA=$(aws cloudformation list-exports --query "Exports[?Name=='$ENV_VAR'].Value" --output text)

# shellcheck disable=SC2154
cat <<EOF > payload.json
{ 
  "currentTag": "$target_tag",
  "targetTag": "$dev_tag",
  "repoName": "prescriptionsforpatients",
  "targetEnvironment": "INT",
  "productName": "Prescritpions for Patients AWS layer",
  "releaseNotesPageId": "693750027",
  "releaseNotesPageTitle": "Current PfP AWS layer release notes - INT"
}
EOF
cat payload.json

aws lambda invoke --function-name "${RELEASE_NOTES_LAMBDA}" --cli-binary-format raw-in-base64-out --payload file://payload.json out.txt
