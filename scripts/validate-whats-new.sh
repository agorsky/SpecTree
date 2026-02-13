#!/usr/bin/env bash

# validate-whats-new.sh
# Validates that a What's New entry exists for the current version before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating What's New entry for deployment..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read version from package.json
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo -e "${RED}❌ ERROR: package.json not found at $PROJECT_ROOT/package.json${NC}"
  exit 1
fi

# Extract version using grep and sed (portable approach)
VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_ROOT/package.json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo -e "${RED}❌ ERROR: Could not extract version from package.json${NC}"
  exit 1
fi

echo -e "${YELLOW}📦 Current version: $VERSION${NC}"

# Check if What's New file exists
WHATS_NEW_FILE="$PROJECT_ROOT/docs/whats-new/v$VERSION.md"

if [ ! -f "$WHATS_NEW_FILE" ]; then
  echo -e "${RED}❌ DEPLOYMENT BLOCKED: What's New entry is missing!${NC}"
  echo ""
  echo "Expected file: docs/whats-new/v$VERSION.md"
  echo ""
  echo "Before deploying version $VERSION, you must:"
  echo "  1. Create docs/whats-new/v$VERSION.md"
  echo "  2. Document the changes in this release"
  echo "  3. Follow the format in docs/whats-new/README.md"
  echo ""
  echo "This ensures users know what changed in each deployment."
  exit 1
fi

echo -e "${GREEN}✅ SUCCESS: What's New entry found at docs/whats-new/v$VERSION.md${NC}"
echo ""
echo "Deployment can proceed. Users will be able to see what changed in v$VERSION."
exit 0
