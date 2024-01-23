#!/usr/bin/env bash

current_deployed_tag=$(aws cloudformation describe-stacks --stack-name "$TARGET_ENVIRONMENT"-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)

echo "CURRENT_DEPLOYED_TAG=${current_deployed_tag}" >> "$GITHUB_ENV"
