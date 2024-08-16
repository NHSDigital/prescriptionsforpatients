#!/usr/bin/env bash

current_deployed_tag=$(aws cloudformation describe-stacks --stack-name "$TARGET_ENVIRONMENT"-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)

if [ -z "$current_deployed_tag" ]
then
     current_deployed_tag=v1.0.970-beta
fi

echo "CURRENT_DEPLOYED_TAG=${current_deployed_tag}" >> "$GITHUB_ENV"
