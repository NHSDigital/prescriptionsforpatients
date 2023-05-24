#!/bin/bash

echo "> Adding dependencies to PATH"

{
  echo "$HOME/.asdf/bin/"
  "$HOME/.asdf/installs/poetry/1.3.1/bin"
  "$HOME/.asdf/installs/python/3.8.15/bin"
} >> "$GITHUB_PATH"

# Got this far? Then we are good
echo "Finished running $(basename "$0")"
exit 0;
