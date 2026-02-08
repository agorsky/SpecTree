#!/bin/bash
set -euo pipefail

# SpecTree Execution Script
# Executes a SpecTree epic using the orchestrator agent.

SCRIPT_NAME="$(basename "$0")"

# Environment variable defaults
SPECTREE_API_URL="${SPECTREE_API_URL:-http://localhost:3001}"
SPECTREE_TOKEN="${SPECTREE_TOKEN:-}"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <epic-id> [--phase <n>] [--dry-run]

Executes a SpecTree epic by delegating features to the orchestrator agent.

Arguments:
  epic-id              Epic ID (UUID) or identifier to execute

Options:
  --phase <n>          Only execute a specific phase number
  --dry-run            Show the execution plan without executing
  --help               Show this help message

Environment variables:
  SPECTREE_API_URL     SpecTree API URL (default: http://localhost:3001)
  SPECTREE_TOKEN       SpecTree API token (required)

Examples:
  ${SCRIPT_NAME} 88cec40c-0ab4-4a6e-afba-ac01f9113b30
  ${SCRIPT_NAME} 88cec40c-0ab4-4a6e-afba-ac01f9113b30 --phase 2
  ${SCRIPT_NAME} 88cec40c-0ab4-4a6e-afba-ac01f9113b30 --dry-run
EOF
}

# Parse arguments
if [[ $# -lt 1 ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

EPIC_ID="$1"
shift

PHASE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      if [[ $# -lt 2 ]]; then
        echo "Error: --phase requires a value" >&2
        exit 1
      fi
      PHASE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
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
if [[ "${DRY_RUN}" == true ]]; then
  PROMPT="Show the execution plan for epic ${EPIC_ID} without executing any tasks. Display phases, dependencies, and parallel groups."
else
  PROMPT="Execute epic ${EPIC_ID}"
  if [[ -n "${PHASE}" ]]; then
    PROMPT="${PROMPT}, phase ${PHASE} only"
  fi
fi

echo "Epic: ${EPIC_ID}"
echo "API URL: ${SPECTREE_API_URL}"
if [[ "${DRY_RUN}" == true ]]; then
  echo "Mode: dry-run (no execution)"
elif [[ -n "${PHASE}" ]]; then
  echo "Phase: ${PHASE}"
fi
echo "---"

# Run the orchestrator agent via Copilot CLI headless mode
copilot -p "@orchestrator ${PROMPT}" --allow-all-tools

EXIT_CODE=$?
if [[ ${EXIT_CODE} -ne 0 ]]; then
  echo "Error: Execution failed with exit code ${EXIT_CODE}" >&2
  exit 1
fi

echo "---"
echo "Execution complete."
