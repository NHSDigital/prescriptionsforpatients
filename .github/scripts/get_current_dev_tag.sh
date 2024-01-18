#!/usr/bin/env bash

if [ "$DRY_RUN" != "true" ]; then
  dev_tag=$(aws cloudformation describe-stacks --stack-name dev-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)
else
  dev_tag="dev_tag"
fi

export dev_tag
echo "dev_tag=${dev_tag}" >> "$GITHUB_ENV"
