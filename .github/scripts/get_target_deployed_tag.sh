#!/usr/bin/env bash

if [ "$DRY_RUN" != "true" ]; then
  current_deployed_tag=$(aws cloudformation describe-stacks --stack-name "$TARGET_ENVIRONMENT"-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)
else
  current_deployed_tag="current_deployed_tag"
fi

export current_deployed_tag
echo "current_deployed_tag=${current_deployed_tag}" >> "$GITHUB_ENV"
