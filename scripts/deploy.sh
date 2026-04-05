#!/bin/bash
set -euo pipefail

echo "=== PixelBoard Deploy ==="

# Reliable project ID from .firebaserc
PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "YOUR_PROJECT_ID" ]; then
  echo "Error: Set your project ID in .firebaserc first."
  exit 1
fi
echo "Project: ${PROJECT_ID}"

# Install dependencies in subshell
echo "[1/3] Installing function dependencies..."
(cd functions && npm ci)

# Sync shared constants to frontend
echo "[2/3] Syncing shared config to frontend..."
"${BASH_SOURCE%/*}/sync-config.sh"

# Deploy everything
echo "[3/3] Deploying hosting, functions & firestore rules..."
firebase deploy --only hosting,functions,firestore

echo ""
echo "=== Deploy complete ==="
echo "Hosting: https://${PROJECT_ID}.web.app"
