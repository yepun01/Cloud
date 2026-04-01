#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <PROJECT_ID>"
  echo "Example: $0 my-pixelboard-project"
  exit 1
fi

PROJECT_ID="$1"

echo "=== PixelBoard GCP Setup ==="
echo "Project: ${PROJECT_ID}"
echo ""

# Set active project
echo "[1/4] Setting active project..."
gcloud config set project "${PROJECT_ID}"

# Enable required APIs
echo "[2/4] Enabling required APIs..."
APIS=(
  cloudfunctions.googleapis.com
  firestore.googleapis.com
  pubsub.googleapis.com
  secretmanager.googleapis.com
  cloudbuild.googleapis.com
  eventarc.googleapis.com
  artifactregistry.googleapis.com
  run.googleapis.com
)
for api in "${APIS[@]}"; do
  echo "  Enabling ${api}..."
  gcloud services enable "${api}" --quiet
done

# Create Firestore database (Native mode)
echo "[3/4] Creating Firestore database (Native mode)..."
if ! output=$(gcloud firestore databases create \
  --location=europe-west1 \
  --type=firestore-native 2>&1); then
  if echo "$output" | grep -q "already exists"; then
    echo "  Firestore database already exists, skipping."
  else
    echo "ERROR: $output" >&2
    exit 1
  fi
fi

# Create Pub/Sub topic for pixel events
echo "[4/4] Creating Pub/Sub topic 'pixel-events'..."
if ! output=$(gcloud pubsub topics create pixel-events 2>&1); then
  if echo "$output" | grep -q "already exists"; then
    echo "  Topic 'pixel-events' already exists, skipping."
  else
    echo "ERROR: $output" >&2
    exit 1
  fi
fi

echo ""
echo "=== Automated setup complete ==="
echo ""
echo "Manual steps remaining:"
echo "  1. Go to https://console.firebase.google.com/ and add project '${PROJECT_ID}'"
echo "  2. Enable Firebase Authentication (Anonymous + Google providers)"
echo "  3. Run 'firebase login' and 'firebase use ${PROJECT_ID}'"
echo "  4. Create a Discord application (see scripts/setup-discord.sh)"
echo "  5. Store Discord secrets in Secret Manager (see scripts/setup-discord.sh)"
echo "  6. Run 'cd functions && npm install'"
echo ""
echo "Done."
