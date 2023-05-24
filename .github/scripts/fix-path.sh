#!/bin/bash

echo "> Fixing PATH by adding dependencies installed via asdf"

PATH="/home/ubuntu/.asdf/installs/poetry/1.3.1/bin:$PATH"
export PATH="/home/ubuntu/.asdf/installs/python/3.8.15/bin:$PATH"

# Got this far? Then we are good
echo "Finished running $(basename "$0")"
exit 0;
