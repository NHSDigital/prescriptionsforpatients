#!/usr/bin/env bash

dev_tag=$(aws cloudformation describe-stacks --stack-name dev-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)

if [ -z "$current_deployed_tag" ]
then
     current_deployed_tag=v1.0.970-beta
fi

echo "DEV_TAG=${dev_tag}" >> "$GITHUB_ENV"
