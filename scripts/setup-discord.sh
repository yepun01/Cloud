#!/bin/bash
set -euo pipefail

cat << 'EOF'
=== PixelBoard Discord Bot Setup ===

Step 1: Create a Discord Application
  - Go to https://discord.com/developers/applications
  - Click "New Application" → name it "PixelBoard"
  - Note the APPLICATION ID and PUBLIC KEY from the General Information page

Step 2: Create a Bot
  - Go to the "Bot" tab
  - Click "Reset Token" to generate a new token
  - Copy the BOT TOKEN (you won't see it again)

Step 3: Set Interaction Endpoint
  - Go to "General Information"
  - Set "Interactions Endpoint URL" to your Cloud Function URL:
    https://<REGION>-<PROJECT_ID>.cloudfunctions.net/discordInteraction
  - Discord will verify the endpoint with a PING — deploy the function first

Step 4: Store secrets in GCP Secret Manager
  Run these commands (replace placeholders with actual values):

    gcloud secrets create discord-bot-token \
      --replication-policy="automatic"
    echo -n "YOUR_BOT_TOKEN" | \
      gcloud secrets versions add discord-bot-token --data-file=-

    gcloud secrets create discord-public-key \
      --replication-policy="automatic"
    echo -n "YOUR_PUBLIC_KEY" | \
      gcloud secrets versions add discord-public-key --data-file=-

    gcloud secrets create discord-app-id \
      --replication-policy="automatic"
    echo -n "YOUR_APP_ID" | \
      gcloud secrets versions add discord-app-id --data-file=-

Step 5: Grant Cloud Functions access to secrets
    gcloud secrets add-iam-policy-binding discord-bot-token \
      --member="serviceAccount:<PROJECT_ID>@appspot.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor"

    (Repeat for discord-public-key and discord-app-id)

Step 6: Invite the bot to your server
  - Go to "OAuth2" → "URL Generator"
  - Select scopes: bot, applications.commands
  - Select permissions: Send Messages, Attach Files
  - Copy the generated URL and open it in your browser

Step 7: Register slash commands
    node scripts/register-commands.js

EOF
