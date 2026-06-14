SHELL := /bin/bash
.DEFAULT_GOAL := help

APP        := Markdown-Kit
BUNDLE_DIR := src-tauri/target/release/bundle/dmg
BUILDS_DIR := builds
VERSION    := $(shell node -p "require('./src-tauri/tauri.conf.json').version")

.PHONY: help dev test build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Run app with hot reload
	pnpm tauri dev

test: ## Frontend (Vitest) + Rust (cargo) tests
	pnpm test
	cargo test --manifest-path src-tauri/Cargo.toml

build: ## Release build → builds/$(APP)-<version>.dmg (overwrites same version)
	pnpm tauri build
	@mkdir -p "$(BUILDS_DIR)"
	@src="$$(ls -t "$(BUNDLE_DIR)"/*.dmg 2>/dev/null | head -1)"; \
	if [ -z "$$src" ]; then echo "error: no .dmg produced in $(BUNDLE_DIR)" >&2; exit 1; fi; \
	dest="$(BUILDS_DIR)/$(APP)-$(VERSION).dmg"; \
	cp "$$src" "$$dest"; \
	echo "archived → $$dest"

clean: ## Remove all archived builds
	rm -rf "$(BUILDS_DIR)"
