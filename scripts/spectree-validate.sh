#!/bin/bash
set -euo pipefail

# SpecTree Validation Script
# Runs validation checks for a SpecTree epic's tasks.

SCRIPT_NAME="$(basename "$0")"

# Environment variable defaults
SPECTREE_API_URL="${SPECTREE_API_URL:-http://localhost:3001}"
SPECTREE_TOKEN="${SPECTREE_TOKEN:-}"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <epic-id> [--feature <id>]

Runs validation checks for a SpecTree epic or specific feature.

Arguments:
  epic-id              Epic ID (UUID) or identifier to validate

Options:
  --feature <id>       Only validate a specific feature (e.g., "ENG-14")
  --help               Show this help message

Environment variables:
  SPECTREE_API_URL     SpecTree API URL (default: http://localhost:3001)
  SPECTREE_TOKEN       SpecTree API token (required)

Examples:
  ${SCRIPT_NAME} 88cec40c-0ab4-4a6e-afba-ac01f9113b30
  ${SCRIPT_NAME} 88cec40c-0ab4-4a6e-afba-ac01f9113b30 --feature ENG-14
EOF
}

# Parse arguments
if [[ $# -lt 1 ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

EPIC_ID="$1"
shift

FEATURE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --feature)
      if [[ $# -lt 2 ]]; then
        echo "Error: --feature requires a value" >&2
        exit 1
      fi
      FEATURE="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Validate environment
if [[ -z "${SPECTREE_TOKEN}" ]]; then
  echo "Error: SPECTREE_TOKEN environment variable is required" >&2
  exit 1
fi

# Build the prompt
PROMPT="Run all validations for epic ${EPIC_ID}"
if [[ -n "${FEATURE}" ]]; then
  PROMPT="${PROMPT}, feature ${FEATURE} only"
fi
PROMPT="${PROMPT}. Report results with pass/fail status for each validation check."

echo "Validating epic: ${EPIC_ID}"
echo "API URL: ${SPECTREE_API_URL}"
if [[ -n "${FEATURE}" ]]; then
  echo "Feature filter: ${FEATURE}"
fi
echo "---"

# Run the reviewer agent via Copilot CLI headless mode
copilot -p "@reviewer ${PROMPT}" --allow-all-tools

EXIT_CODE=$?
if [[ ${EXIT_CODE} -ne 0 ]]; then
  echo "Error: Validation failed with exit code ${EXIT_CODE}" >&2
  exit 1
fi

echo "---"
echo "Validation complete."
