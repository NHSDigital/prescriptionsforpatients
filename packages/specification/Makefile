SHELL=/bin/bash -euo pipefail

.PHONY: install build test publish release clean

install:
	npm ci

clean:
	rm -rf dist/

build:
	mkdir -p dist
	npm run lint
	npm run resolve
