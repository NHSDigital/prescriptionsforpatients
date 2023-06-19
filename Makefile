guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

.PHONY: install build test publish release clean

install: install-python install-hooks install-node

install-node:
	npm ci

install-python:
	poetry install

install-hooks: install-python
	poetry run pre-commit install --install-hooks --overwrite

sam-build: sam-validate
	sam build

sam-build-sandbox: sam-validate-sandbox
	sam sync --stack-name $$stack_name-sandbox --watch -t sandbox_template.yaml

sam-run-local: sam-build
	sam local start-api

sam-sync: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam sync --stack-name $$stack_name --watch

sam-sync-sandbox: guard-stack_name
	sam sync --stack-name $$stack_name-sandbox --watch -t sandbox_template.yaml

sam-deploy: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam deploy --stack-name $$stack_name

sam-delete: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam delete --stack-name $$stack_name

sam-list-endpoints: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list endpoints --stack-name $$stack_name

sam-list-resources: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list resources --stack-name $$stack_name

sam-list-outputs: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list stack-outputs --stack-name $$stack_name

sam-validate: 
	sam validate

sam-validate-sandbox: 
	sam build --template-file sandbox_template.yaml

sam-deploy-package: guard-artifact_bucket guard-artifact_bucket_prefix guard-stack_name guard-template_file guard-cloud_formation_execution_role
	sam deploy \
		--template-file $$template_file \
		--stack-name $$stack_name \
		--capabilities CAPABILITY_NAMED_IAM \
		--region eu-west-2 \
		--s3-bucket $$artifact_bucket \
		--s3-prefix $$artifact_bucket_prefix \
		--config-file samconfig_package_and_deploy.toml \
		--no-fail-on-empty-changeset \
		--role-arn $$cloud_formation_execution_role \
		--no-confirm-changeset \
		--parameter-overrides TargetSpineServer=$$target_spine_server \
		--force-upload

lint:
	npm run lint --workspace packages/authz
	npm run lint --workspace packages/getMyPrescriptions
	npm run lint --workspace packages/sandbox

test:
	npm run test --workspace packages/authz
	npm run test --workspace packages/getMyPrescriptions
	npm run test --workspace packages/sandbox

clean:
	rm -rf packages/authz/coverage
	rm -rf packages/getMyPrescriptions/coverage
	rm -rf packages/sandbox/coverage
	rm -rf .aws-sam

deep-clean: clean
	rm -rf .venv
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +

check-licenses:
	npm run check-licenses --workspace packages/authz
	npm run check-licenses --workspace packages/getMyPrescriptions
	scripts/check_python_licenses.sh

aws-configure:
	aws configure sso --region eu-west-2

aws-login:
	aws sso login --sso-session sso-session
