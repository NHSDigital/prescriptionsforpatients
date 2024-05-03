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

sam-build: sam-validate compile download-get-secrets-layer
	sam build --template-file SAMtemplates/main_template.yaml --region eu-west-2

#to be removed
sam-build-old: sam-validate compile download-get-secrets-layer
	sam build --template-file SAMtemplates/main_template.old.yaml --region eu-west-2

sam-build-sandbox: sam-validate-sandbox compile download-get-secrets-layer
	sam build --template-file SAMtemplates/sandbox_template.yaml --region eu-west-2

sam-run-local: sam-build
	sam local start-api

sam-sync: guard-AWS_DEFAULT_PROFILE guard-stack_name compile download-get-secrets-layer
	sam sync \
		--stack-name $$stack_name \
		--watch \
		--template-file SAMtemplates/main_template.yaml \
		--parameter-overrides \
			  EnableSplunk=false\
			  TargetSpineServer=$$TARGET_SPINE_SERVER \
			  TargetServiceSearchServer=$$TARGET_SERVICE_SEARCH_SERVER

sam-sync-sandbox: guard-stack_name compile download-get-secrets-layer
	sam sync \
		--stack-name $$stack_name-sandbox \
		--watch \
		--template-file SAMtemplates/sandbox_template.yaml \
		--parameter-overrides \
			  EnableSplunk=false

sam-deploy: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam deploy \
		--stack-name $$stack_name \
		--parameter-overrides \
			  EnableSplunk=false \
			  TargetSpineServer=$$TARGET_SPINE_SERVER \
			  TargetServiceSearchServer=$$TARGET_SERVICE_SEARCH_SERVER

sam-delete: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam delete --stack-name $$stack_name

sam-list-endpoints: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list endpoints --stack-name $$stack_name

sam-list-resources: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list resources --stack-name $$stack_name

sam-list-outputs: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list stack-outputs --stack-name $$stack_name

sam-validate: 
	sam validate --template-file SAMtemplates/main_template.old.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/lambda_resources.old.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/main_template.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/apis/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/apis/api_resources.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/functions/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/functions/lambda_resources.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/state_machines/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/state_machines/state_machine_resources.yaml --region eu-west-2


sam-validate-sandbox: 
	sam validate --template-file SAMtemplates/sandbox_template.yaml --region eu-west-2

sam-deploy-package: guard-artifact_bucket guard-artifact_bucket_prefix guard-stack_name guard-template_file guard-cloud_formation_execution_role guard-LATEST_TRUSTSTORE_VERSION guard-enable_mutual_tls guard-VERSION_NUMBER guard-COMMIT_ID guard-LOG_LEVEL guard-LOG_RETENTION_DAYS guard-TARGET_ENVIRONMENT guard-target_spine_server guard-target_service_search_server guard-TOGGLE_GET_STATUS_UPDATES
	sam deploy \
		--template-file $$template_file \
		--stack-name $$stack_name \
		--capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
		--region eu-west-2 \
		--s3-bucket $$artifact_bucket \
		--s3-prefix $$artifact_bucket_prefix \
		--config-file samconfig_package_and_deploy.toml \
		--no-fail-on-empty-changeset \
		--role-arn $$cloud_formation_execution_role \
		--no-confirm-changeset \
		--force-upload \
		--tags "version=$$VERSION_NUMBER" \
		--parameter-overrides \
			  TruststoreVersion=$$LATEST_TRUSTSTORE_VERSION \
			  EnableMutualTLS=$$enable_mutual_tls \
			  TargetSpineServer=$$target_spine_server \
			  TargetServiceSearchServer=$$target_service_search_server \
			  EnableSplunk=true \
			  VersionNumber=$$VERSION_NUMBER \
			  CommitId=$$COMMIT_ID \
			  LogLevel=$$LOG_LEVEL \
			  LogRetentionInDays=$$LOG_RETENTION_DAYS \
			  Env=$$TARGET_ENVIRONMENT \
			  ToggleGetStatusUpdates=$$TOGGLE_GET_STATUS_UPDATES

compile-node:
	npx tsc --build tsconfig.build.json

compile: compile-node

download-get-secrets-layer:
	mkdir -p packages/getSecretLayer/lib
	curl -LJ https://github.com/NHSDigital/electronic-prescription-service-get-secrets/releases/download/v1.0.197-alpha/get-secrets-layer.zip -o packages/getSecretLayer/lib/get-secrets-layer.zip

lint-node: compile-node
	npm run lint --workspace packages/capabilityStatement
	npm run lint --workspace packages/getMyPrescriptions
	npm run lint --workspace packages/enrichPrescriptions
	npm run lint --workspace packages/sandbox
	npm run lint --workspace packages/statusLambda
	npm run lint --workspace packages/serviceSearchClient
	npm run lint --workspace packages/common/testing
	npm run lint --workspace packages/distanceSelling

lint-samtemplates:
	poetry run cfn-lint -I "SAMtemplates/**/*.yaml" 2>&1 | grep "Run scan"

lint-python:
	poetry run flake8 scripts/*.py --config .flake8

lint-githubactions:
	actionlint

lint-githubaction-scripts:
	shellcheck .github/scripts/*.sh

lint: lint-node lint-samtemplates lint-python lint-githubactions lint-githubaction-scripts

test: compile
	npm run test --workspace packages/capabilityStatement
	npm run test --workspace packages/getMyPrescriptions
	npm run test --workspace packages/enrichPrescriptions
	npm run test --workspace packages/sandbox
	npm run test --workspace packages/statusLambda
	npm run test --workspace packages/serviceSearchClient
	npm run test --workspace packages/distanceSelling

clean:
	rm -rf packages/capabilityStatement/coverage
	rm -rf packages/getMyPrescriptions/coverage
	rm -rf packages/enrichPrescriptions/coverage
	rm -rf packages/sandbox/coverage
	rm -rf packages/serviceSearchClient/coverage
	rm -rf packages/distanceSelling/coverage
	rm -rf packages/statusLambda/coverage
	rm -rf packages/common/testing/coverage
	rm -rf packages/capabilityStatement/lib
	rm -rf packages/getMyPrescriptions/lib
	rm -rf packages/enrichPrescriptions/lib
	rm -rf packages/sandbox/lib
	rm -rf packages/serviceSearchClient/lib
	rm -rf packages/distanceSelling/lib
	rm -rf packages/statusLambda/lib
	rm -rf packages/getSecretLayer/lib
	rm -rf packages/common/testing/lib
	rm -rf .aws-sam

deep-clean: clean
	rm -rf .venv
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +

check-licenses: check-licenses-node check-licenses-python

check-licenses-node:
	npm run check-licenses
	npm run check-licenses --workspace packages/getMyPrescriptions
	npm run check-licenses --workspace packages/enrichPrescriptions
	npm run check-licenses --workspace packages/capabilityStatement
	npm run check-licenses --workspace packages/sandbox
	npm run check-licenses --workspace packages/statusLambda
	npm run check-licenses --workspace packages/serviceSearchClient
	npm run check-licenses --workspace packages/distanceSelling

check-licenses-python:
	scripts/check_python_licenses.sh

aws-configure:
	aws configure sso --region eu-west-2

aws-login:
	aws sso login --sso-session sso-session
