run-jekyll:
	bundle exec jekyll serve

sync-main:
	git checkout main .tool-versions
	git checkout main .pre-commit-config.yaml
	git checkout main .gitignore
	git checkout main .devcontainer
	git checkout main pyproject.toml
	git checkout main poetry.lock
	git checkout main poetry.lock
	git checkout main package.json
	git checkout main package-lock.json

# install targets
install: install-python install-hooks install-node install-jekyll

install-python:
	poetry install

install-node:
	npm ci

install-jekyll:
	gem install jekyll bundler
	bundle install

install-hooks: install-python
	poetry run pre-commit install --install-hooks --overwrite
