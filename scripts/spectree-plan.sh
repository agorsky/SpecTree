#!/bin/bash
set -euo pipefail

# SpecTree Planning Script
# Creates a SpecTree epic from a natural language description using the planner agent.

SCRIPT_NAME="$(basename "$0")"

# Environment variable defaults
SPECTREE_API_URL="${SPECTREE_API_URL:-http://localhost:3001}"
SPECTREE_TOKEN="${SPECTREE_TOKEN:-}"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} <description> [--team <name>] [--gates <mode>]

Creates a SpecTree epic from a natural language description.

Arguments:
  description          Natural language description of the work to plan

Options:
  --team <name>        Team to create the epic under (e.g., "Engineering")
  --gates <mode>       Review gate mode: "interactive" (default) or "auto"
  --help               Show this help message

Environment variables:
  SPECTREE_API_URL     SpecTree API URL (default: http://localhost:3001)
  SPECTREE_TOKEN       SpecTree API token (required)

Examples:
  ${SCRIPT_NAME} "Add user authentication with JWT tokens"
  ${SCRIPT_NAME} "Build REST API for preferences" --team Engineering
  ${SCRIPT_NAME} "Refactor database layer" --gates auto
EOF
}

# Parse arguments
if [[ $# -lt 1 ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DESCRIPTION="$1"
shift

TEAM=""
GATES="interactive"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team)
      if [[ $# -lt 2 ]]; then
        echo "Error: --team requires a value" >&2
        exit 1
      fi
      TEAM="$2"
      shift 2
      ;;
    --gates)
      if [[ $# -lt 2 ]]; then
        echo "Error: --gates requires a value" >&2
        exit 1
      fi
      GATES="$2"
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
PROMPT="Create a SpecTree epic for: ${DESCRIPTION}"
if [[ -n "${TEAM}" ]]; then
  PROMPT="${PROMPT}. Use team: ${TEAM}"
fi
if [[ "${GATES}" == "auto" ]]; then
  PROMPT="${PROMPT}. Auto-approve all review gates."
fi

echo "Planning epic: ${DESCRIPTION}"
echo "API URL: ${SPECTREE_API_URL}"
echo "---"

# Run the planner agent via Copilot CLI headless mode
copilot -p "@planner ${PROMPT}" --allow-all-tools

EXIT_CODE=$?
if [[ ${EXIT_CODE} -ne 0 ]]; then
  echo "Error: Planning failed with exit code ${EXIT_CODE}" >&2
  exit 1
fi

echo "---"
echo "Planning complete."
