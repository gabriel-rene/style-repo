#!/bin/sh
# One-time repo setup: install deps, wire pre-commit hook.
set -e
cd "$(dirname "$0")/.."
npm install
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
echo "setup: done — pre-commit validation active"
