#!/bin/bash
set -euo pipefail

# Generate web/public/constants.js from shared/constants.json
# Run this before deploying frontend or during development

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "${REPO_ROOT}/shared/constants.json" ]; then
  echo "Error: shared/constants.json not found."
  exit 1
fi

node "${REPO_ROOT}/scripts/sync-config-gen.js" "${REPO_ROOT}"
echo "Synced shared/constants.json → web/public/constants.js"
