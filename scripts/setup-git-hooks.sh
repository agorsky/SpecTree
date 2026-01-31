#!/bin/bash
# Configure git to use project hooks
# Run once after cloning: ./scripts/setup-git-hooks.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up Git hooks for Git Release Flow..."

# Configure git to use .githooks directory
git config core.hooksPath .githooks

echo "✅ Git hooks configured!"
echo ""
echo "Hooks installed:"
echo "  - post-checkout: Reminds to sync before starting work"
echo "  - pre-push: Blocks force push to main/release branches"
echo ""
echo "To disable: git config --unset core.hooksPath"
