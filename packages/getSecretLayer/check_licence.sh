#!/usr/bin/env bash

cd ./src

# install dependencies
go mod download

# fix GOROOT and PATH
go_path="$(asdf which go)"
GOROOT="$(dirname "$(dirname "${go_path:A}")")"
PATH=$PATH:$GOROOT/../packages/bin

# install go-licencses
go install github.com/google/go-licenses@latest

echo "Report on licensces"
go-licenses report . 

echo
echo "Checking for incompatible licenses"
go-licenses check . --disallowed_types forbidden,restricted
