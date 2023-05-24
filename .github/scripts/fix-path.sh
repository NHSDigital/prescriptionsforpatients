#!/bin/bash

echo "> Fixing PATH by adding dependencies installed via asdf"

echo "/home/ubuntu/.asdf/installs/poetry/1.3.1/bin" >> "$GITHUB_PATH"
echo "/home/ubuntu/.asdf/installs/python/3.8.15/bin" >> "$GITHUB_PATH"

# Got this far? Then we are good
echo "Finished running $(basename "$0")"
exit 0;
