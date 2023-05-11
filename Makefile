.PHONY: install build test publish release clean

install: install-python install-hooks install-node

install-node:
	npm ci

install-python:
	poetry install

install-hooks: install-python
	poetry run pre-commit install --install-hooks --overwrite

sam-build:
	sam build

sam-run-local: sam-build
	sam local start-api

sam-sync:
	sam sync --watch

lint:
	npm run lint --workspace packages/authz
	npm run lint --workspace packages/getMyPrescriptions

test:
	npm run test --workspace packages/authz
	npm run test --workspace packages/getMyPrescriptions

clean:
	rm -rf packages/authz/coverage
	rm -rf packages/getMyPrescriptions/coverage
	rm -rf .aws-sam

deep-clean: clean
	rm -rf .venv
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +

check-licenses:
	npm run check-licenses --workspace packages/authz
	npm run check-licenses --workspace packages/getMyPrescriptions
	scripts/check_python_licenses.sh
