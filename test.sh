#!/usr/bin/env bash
set -e
echo "Fetching latest release info for EPS Spine Shared Library from GitHub..."

echo "Cleaning /tmp/"

#rm -r /tmp/eps*

curl -L \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/NHSDigital/eps-spine-shared/releases/latest > /tmp/eps-shared-library-latest-release

echo "Fetched latest release info from GitHub"

echo "Extracting version number"

VERSION=$(cat /tmp/eps-shared-library-latest-release | jq -r '.tag_name' | sed 's/^v//')

echo "Latest version is $VERSION"

echo "Extracting zip asset"

cat /tmp/eps-shared-library-latest-release | jq '.assets[] | select(.name | endswith(".zip")) | .browser_download_url' > /tmp/eps-shared-library-zip-url

echo "Found zip asset URL: $(cat /tmp/eps-shared-library-zip-url)"

echo "Verifying release"

gh release verify --repo https://github.com/NHSDigital/eps-spine-shared "v$VERSION"

echo "Downloading zip asset..."

#wget $(cat /tmp/eps-shared-library-zip-url | tr -d '"') -O /tmp/eps-spine-shared-library-latest.zip

echo "Verifying downloaded asset"

gh release verify-asset \
    --repo NHSDigital/eps-spine-shared \
    /tmp/eps-spine-shared-library-latest.zip

echo "All done!"
