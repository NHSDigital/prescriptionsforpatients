#!/usr/bin/env bash

dev_tag=$(aws cloudformation describe-stacks --stack-name dev-ci --query "Stacks[0].Tags[?Key=='version'].Value" --output text)
export dev_tag
echo "dev_tag=${dev_tag}" >> "$GITHUB_ENV"
