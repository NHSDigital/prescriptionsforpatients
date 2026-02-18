.PHONY: install build test publish release clean install-node install-python install-hooks sam-build sam-build-sandbox sam-run-local sam-sync sam-sync-sandbox sam-deploy sam-delete sam-list-endpoints sam-list-resources sam-list-outputs sam-validate sam-validate-sandbox sam-deploy-package compile-node compile compile-specification download-get-secrets-layer lint-node lint test clean deep-clean

install: install-python install-hooks install-node

install-node:
	npm ci

install-python:
	poetry install

install-hooks: install-python
	poetry run pre-commit install --install-hooks --overwrite

sam-build: sam-validate compile download-get-secrets-layer
	sam build --template-file SAMtemplates/main_template.yaml --region eu-west-2

sam-build-sandbox: sam-validate-sandbox compile download-get-secrets-layer
	sam build --template-file SAMtemplates/sandbox_template.yaml --region eu-west-2

sam-run-local: sam-build
	sam local start-api

sam-sync: guard-AWS_DEFAULT_PROFILE guard-stack_name compile download-get-secrets-layer guard-TARGET_SERVICE_SEARCH_SERVER guard-TARGET_SPINE_SERVER
	sam sync \
		--stack-name $$stack_name \
		--watch \
		--template-file SAMtemplates/main_template.yaml \
		--parameter-overrides \
			  EnableSplunk=false\
			  TargetSpineServer=$$TARGET_SPINE_SERVER \
			  TargetServiceSearchServer=$$TARGET_SERVICE_SEARCH_SERVER \
				EnableAlerts=false

sam-sync-sandbox: guard-stack_name compile download-get-secrets-layer
	sam sync \
		--stack-name $$stack_name-sandbox \
		--watch \
		--template-file SAMtemplates/sandbox_template.yaml \
		--parameter-overrides \
			  EnableSplunk=false

sam-deploy: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam deploy \
		--template-file SAMtemplates/main_template.yaml \
		--stack-name $$stack_name \
		--parameter-overrides \
			  EnableSplunk=false \
			  TargetSpineServer=$$TARGET_SPINE_SERVER \
			  TargetServiceSearchServer=$$TARGET_SERVICE_SEARCH_SERVER \
				EnableAlerts=false

sam-delete: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam delete --stack-name $$stack_name

sam-list-endpoints: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list endpoints --stack-name $$stack_name

sam-list-resources: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list resources --stack-name $$stack_name

sam-list-outputs: guard-AWS_DEFAULT_PROFILE guard-stack_name
	sam list stack-outputs --stack-name $$stack_name

sam-validate:
	sam validate --template-file SAMtemplates/main_template.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/apis/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/apis/api_resources.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/functions/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/functions/lambda_resources.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/state_machines/main.yaml --region eu-west-2
	sam validate --template-file SAMtemplates/state_machines/state_machine_resources.yaml --region eu-west-2


sam-validate-sandbox:
	sam validate --template-file SAMtemplates/sandbox_template.yaml --region eu-west-2

sam-deploy-package: guard-artifact_bucket guard-artifact_bucket_prefix guard-stack_name guard-template_file guard-cloud_formation_execution_role guard-LATEST_TRUSTSTORE_VERSION guard-TRUSTSTORE_FILE guard-enable_mutual_tls guard-VERSION_NUMBER guard-COMMIT_ID guard-LOG_LEVEL guard-LOG_RETENTION_DAYS guard-TARGET_ENVIRONMENT guard-target_spine_server guard-target_service_search_server guard-TOGGLE_GET_STATUS_UPDATES
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
				TruststoreFile=$$TRUSTSTORE_FILE \
			  EnableMutualTLS=$$enable_mutual_tls \
			  TargetSpineServer=$$target_spine_server \
			  TargetServiceSearchServer=$$target_service_search_server \
			  EnableSplunk=true \
			  VersionNumber=$$VERSION_NUMBER \
			  CommitId=$$COMMIT_ID \
			  LogLevel=$$LOG_LEVEL \
			  LogRetentionInDays=$$LOG_RETENTION_DAYS \
			  Env=$$TARGET_ENVIRONMENT \
			  ToggleGetStatusUpdates=$$TOGGLE_GET_STATUS_UPDATES \
			  EnableAlerts=$$ENABLE_ALERTS \
			  StateMachineLogLevel=$$STATE_MACHINE_LOG_LEVEL

compile-node:
	npx tsc --build tsconfig.build.json

compile: compile-node compile-specification

compile-specification:
	npm run compile --workspace packages/specification

download-get-secrets-layer:
	mkdir -p packages/getSecretLayer/lib
	@if [ -f packages/getSecretLayer/lib/get-secrets-layer.zip ]; then \
		echo "File already exists, skipping download"; \
	else \
		echo "Fetching latest release version..."; \
		TAG=$$(curl -sSf --retry 3 --retry-delay 2 "https://api.github.com/repos/NHSDigital/electronic-prescription-service-get-secrets/releases/latest" | jq -r .tag_name) || { echo "Error: Failed to fetch latest release version"; exit 1; }; \
		echo "Latest version: $$TAG"; \
		echo "Downloading get-secrets-layer.zip..."; \
		curl -sSfL --retry 3 --retry-delay 2 \
			"https://github.com/NHSDigital/electronic-prescription-service-get-secrets/releases/download/$$TAG/get-secrets-layer.zip" \
			-o packages/getSecretLayer/lib/get-secrets-layer.zip || { echo "Error: Failed to download get-secrets-layer.zip"; rm -f packages/getSecretLayer/lib/get-secrets-layer.zip; exit 1; }; \
		echo "Download complete"; \
	fi

lint-node: compile-node
	npm run lint --workspace packages/capabilityStatement
	npm run lint --workspace packages/getMyPrescriptions
	npm run lint --workspace packages/enrichPrescriptions
	npm run lint --workspace packages/nhsd-pfp-sandbox
	npm run lint --workspace packages/statusLambda
	npm run lint --workspace packages/serviceSearchClient
	npm run lint --workspace packages/common/utilities
	npm run lint --workspace packages/common/testing
	npm run lint --workspace packages/distanceSelling

lint: lint-node actionlint shellcheck cfn-lint
	echo "Linting complete"

test: compile
	npm run test --workspace packages/capabilityStatement
	npm run test --workspace packages/getMyPrescriptions
	npm run test --workspace packages/enrichPrescriptions
	npm run test --workspace packages/nhsd-pfp-sandbox
	npm run test --workspace packages/statusLambda
	npm run test --workspace packages/serviceSearchClient
	npm run test --workspace packages/distanceSelling
	npm run test --workspace packages/common/utilities
	npm run test --workspace packages/common/testing

clean:
	rm -rf packages/capabilityStatement/coverage
	rm -rf packages/getMyPrescriptions/coverage
	rm -rf packages/enrichPrescriptions/coverage
	rm -rf packages/nhsd-pfp-sandbox/coverage
	rm -rf packages/serviceSearchClient/coverage
	rm -rf packages/distanceSelling/coverage
	rm -rf packages/statusLambda/coverage
	rm -rf packages/common/testing/coverage
	rm -rf packages/capabilityStatement/lib
	rm -rf packages/getMyPrescriptions/lib
	rm -rf packages/enrichPrescriptions/lib
	rm -rf packages/nhsd-pfp-sandbox/lib
	rm -rf packages/serviceSearchClient/lib
	rm -rf packages/distanceSelling/lib
	rm -rf packages/statusLambda/lib
	rm -rf packages/getSecretLayer/lib
	rm -rf packages/common/utilities/lib
	rm -rf packages/common/testing/lib
	rm -rf .aws-sam
	find . -name 'lib' -type d -prune -exec rm -rf '{}' +
	find . -name 'coverage' -type d -prune -exec rm -rf '{}' +
	find . -name 'tsconfig.tsbuildinfo' -type f -prune -exec rm '{}' +

deep-clean: clean
	rm -rf .venv
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +

%:
	@$(MAKE) -f /usr/local/share/eps/Mk/common.mk $@
