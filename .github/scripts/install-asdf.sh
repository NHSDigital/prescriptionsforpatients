#!/bin/bash

echo "> Installing asdf"

git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.11.2; \
echo ". $HOME/.asdf/asdf.sh" >> ~/.bashrc; \
echo ". $HOME/.asdf/completions/asdf.bash" >> ~/.bashrc;

export PATH="$PATH:$HOME/.asdf/bin/"

# Install ASDF plugins
asdf plugin-add direnv; \
asdf plugin-add java; \
asdf plugin add python; \
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git; \
asdf plugin add poetry https://github.com/asdf-community/asdf-poetry.git; \
asdf plugin add shellcheck https://github.com/luizm/asdf-shellcheck.git;

# Got this far? Then we are good
echo "Finished running $(basename "$0")"
exit 0;
