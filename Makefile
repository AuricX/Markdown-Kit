SHELL := /bin/bash
.DEFAULT_GOAL := help

APP        := Markdown-Kit
BUNDLE_DIR := src-tauri/target/release/bundle/dmg
BUILDS_DIR := builds
VERSION    := $(shell node -p "require('./src-tauri/tauri.conf.json').version")

.PHONY: help dev test build clean bump release guard-version unrelease

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

bump: ## Set version in all manifests, e.g. make bump VERSION=0.1.1
	@test -n "$(VERSION)" || { echo "usage: make bump VERSION=x.y.z" >&2; exit 1; }
	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$' || { echo "error: VERSION must be semver (x.y.z)" >&2; exit 1; }
	@sed -i '' -E 's/"version": "[0-9]+\.[0-9]+\.[0-9]+"/"version": "$(VERSION)"/' package.json src-tauri/tauri.conf.json
	@sed -i '' -E 's/^version = "[0-9]+\.[0-9]+\.[0-9]+"/version = "$(VERSION)"/' src-tauri/Cargo.toml
	@cd src-tauri && cargo update -p markdown-kit >/dev/null 2>&1 || true
	@echo "bumped to $(VERSION)"

# Refuse a release that isn't strictly newer than the latest existing tag.
# Versions only move forward, otherwise GitHub's "latest" (newest by date)
# would serve an older build to new downloaders. Runs before bump so nothing
# is mutated when it fails.
guard-version:
	@test -n "$(VERSION)" || { echo "usage: make release VERSION=x.y.z" >&2; exit 1; }
	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$' || { echo "error: VERSION must be semver (x.y.z)" >&2; exit 1; }
	@git fetch --tags --quiet 2>/dev/null || true
	@latest=$$(git tag -l 'v*' --sort=-v:refname | head -1 | sed 's/^v//'); \
	if [ -n "$$latest" ]; then \
	  top=$$(printf '%s\n%s\n' "$$latest" "$(VERSION)" | sort -V | tail -1); \
	  if [ "$(VERSION)" = "$$latest" ] || [ "$$top" != "$(VERSION)" ]; then \
	    echo "error: VERSION $(VERSION) must be greater than latest release $$latest" >&2; exit 1; \
	  fi; \
	fi; \
	echo "version ok: $(VERSION) > $${latest:-none}"

release: guard-version bump ## Bump + commit + tag + push, e.g. make release VERSION=0.1.1 (triggers CI release)
	@git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
	@git commit -m "chore: release v$(VERSION)"
	@git tag "v$(VERSION)"
	@git push && git push origin "v$(VERSION)"
	@echo "pushed v$(VERSION) — GitHub Actions is building the release"

# Delete a published release and its tag (local + remote). Use for a mistaken
# version (e.g. tagged way too high) or to pull a build with known issues.
# GitHub's "latest" then falls back to the previous release. Clients that
# already auto-updated cannot be rolled back — this only stops new downloads.
#   make unrelease VERSION=0.9.9
unrelease: ## Delete a release + tag (local + remote), e.g. make unrelease VERSION=0.9.9
	@test -n "$(VERSION)" || { echo "usage: make unrelease VERSION=x.y.z" >&2; exit 1; }
	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$' || { echo "error: VERSION must be semver (x.y.z)" >&2; exit 1; }
	@echo "deleting release v$(VERSION) and its tag (local + remote)…"
	@gh release delete "v$(VERSION)" --cleanup-tag --yes 2>/dev/null || echo "note: no GitHub release v$(VERSION) (or gh not authed)"
	@git tag -d "v$(VERSION)" 2>/dev/null || true
	@git push origin ":refs/tags/v$(VERSION)" 2>/dev/null || true
	@echo "done — GitHub 'latest' now falls back to the previous release"
