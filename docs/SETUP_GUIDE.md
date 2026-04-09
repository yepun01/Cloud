# PixelBoard — Guide de Setup Complet

De repo scaffolde a projet deploye, etape par etape.

---

## Prerequis

Installe tout ce qui suit avant de commencer.

- [ ] **Node.js 20+**
  ```bash
  brew install node@20
  node --version  # doit afficher v20.x.x+
  ```

- [ ] **Google Cloud CLI (gcloud)**
  ```bash
  brew install --cask google-cloud-sdk
  gcloud --version
  gcloud auth login
  ```

- [ ] **Firebase CLI**
  ```bash
  npm install -g firebase-tools
  firebase --version  # doit afficher 13.x.x+
  ```

- [ ] **Git** (deja installe si tu lis ce repo)

---

## Etape 1 : Projet GCP

### 1.1 Creer le projet

- [ ] Va sur **https://console.cloud.google.com/projectcreate**
- [ ] Choisis un Project ID unique (ex: `pixelboard-epitech-2026`) — note-le, tu en auras besoin partout
- [ ] Clique "Create"

### 1.2 Activer la facturation

- [ ] Va sur **https://console.cloud.google.com/billing**
- [ ] Lie un compte de facturation au projet (obligatoire pour Cloud Functions et les APIs)

> **Erreur courante** : sans facturation activee, `gcloud services enable` echouera silencieusement ou retournera `PERMISSION_DENIED`.

### 1.3 Lancer le script de setup GCP

```bash
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh <TON_PROJECT_ID>
```

Ce script fait automatiquement :
- Configure gcloud sur le bon projet
- Active les 8 APIs necessaires (Cloud Functions, Firestore, Pub/Sub, Secret Manager, Cloud Build, Eventarc, Artifact Registry, Cloud Run)
- Cree la base Firestore en mode Native (region `europe-west1`)
- Cree le topic Pub/Sub `pixel-events`

> **Erreur courante** : `ERROR: (gcloud.firestore.databases.create) ALREADY_EXISTS` — le script gere ce cas, pas de panique.

> **Erreur courante** : `API [cloudbuild.googleapis.com] not enabled` — verifie que la facturation est bien activee (etape 1.2).

---

## Etape 2 : Firebase

### 2.1 Ajouter le projet a Firebase

- [ ] Va sur **https://console.firebase.google.com/**
- [ ] Clique "Add project" (ou "Ajouter un projet")
- [ ] Selectionne le projet GCP que tu viens de creer (il apparait dans la liste)
- [ ] Desactive Google Analytics (pas necessaire)
- [ ] Clique "Continue" pour finaliser

### 2.2 Activer Firebase Authentication

- [ ] Dans la console Firebase, va dans **Build > Authentication**
- [ ] Clique "Get started"
- [ ] Active le provider **Anonymous** (toggle ON, Save)
- [ ] Active le provider **Google** (configure avec ton email comme support email, Save)

### 2.3 Connecter le CLI Firebase au projet

```bash
firebase login
```

### 2.4 Configurer `.firebaserc`

Edite `.firebaserc` et remplace `YOUR_PROJECT_ID` par ton vrai Project ID :

```json
{
  "projects": {
    "default": "pixelboard-epitech-2026"
  }
}
```

Puis verifie :

```bash
firebase use default
```

Tu dois voir `Now using project pixelboard-epitech-2026`.

### 2.5 Installer les dependances des fonctions

```bash
cd functions && npm install && cd ..
```

> **Note** : `firebase.json`, `firestore.rules` et `firestore.indexes.json` sont deja configures dans le repo. Pas besoin de `firebase init`.

---

## Etape 3 : Application Discord

### 3.1 Creer l'application

- [ ] Va sur **https://discord.com/developers/applications**
- [ ] Clique **"New Application"** et nomme-la `PixelBoard`
- [ ] Sur la page **General Information**, note :
  - `APPLICATION ID` (= App ID)
  - `PUBLIC KEY`

### 3.2 Creer le bot

- [ ] Va dans l'onglet **"Bot"**
- [ ] Clique **"Reset Token"** pour generer un token
- [ ] **Copie le BOT TOKEN immediatement** — il ne sera plus affiche apres

> **Erreur courante** : tu fermes la page sans copier le token. Il faudra faire "Reset Token" a nouveau, ce qui invalidera l'ancien.

### 3.3 Stocker les secrets dans GCP Secret Manager

Remplace les placeholders par les vraies valeurs :

```bash
# Bot Token
gcloud secrets create discord-bot-token \
  --replication-policy="automatic"
echo -n "COLLE_TON_BOT_TOKEN_ICI" | \
  gcloud secrets versions add discord-bot-token --data-file=-

# Public Key
gcloud secrets create discord-public-key \
  --replication-policy="automatic"
echo -n "COLLE_TA_PUBLIC_KEY_ICI" | \
  gcloud secrets versions add discord-public-key --data-file=-

# Application ID
gcloud secrets create discord-app-id \
  --replication-policy="automatic"
echo -n "COLLE_TON_APP_ID_ICI" | \
  gcloud secrets versions add discord-app-id --data-file=-
```

> **Erreur courante** : `ALREADY_EXISTS` — le secret existe deja. Ajoute juste une nouvelle version :
> ```bash
> echo -n "NOUVELLE_VALEUR" | gcloud secrets versions add discord-bot-token --data-file=-
> ```

### 3.4 Donner acces aux secrets a Cloud Functions

```bash
PROJECT_ID=$(gcloud config get-value project)

for SECRET in discord-bot-token discord-public-key discord-app-id; do
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3.5 Inviter le bot sur un serveur Discord

- [ ] Va dans **OAuth2 > URL Generator**
- [ ] Coche les scopes : **`bot`**, **`applications.commands`**
- [ ] Coche les permissions bot : **Send Messages**, **Attach Files**
- [ ] Copie l'URL generee et ouvre-la dans ton navigateur
- [ ] Selectionne ton serveur de test et autorise

---

## Etape 4 : Enregistrer les Slash Commands

Recupere ton App ID et Bot Token (depuis le Developer Portal ou Secret Manager), puis lance :

```bash
DISCORD_APP_ID="TON_APP_ID" \
DISCORD_BOT_TOKEN="TON_BOT_TOKEN" \
node scripts/register-commands.js
```

Resultat attendu :
```
Registered 3 commands:
  /place — Place a pixel on the canvas
  /canvas — View the current canvas state
  /info — Show PixelBoard info (canvas size, cooldown, your stats)
```

> **Erreur courante** : `Error 401: {"message": "401: Unauthorized"}` — le Bot Token est invalide ou expire. Regenere-le dans le Developer Portal (onglet Bot > Reset Token).

> **Note** : les slash commands globales peuvent mettre jusqu'a 1 heure pour apparaitre dans Discord. Pour un test instantane, utilise des commandes de guilde (pas couvert ici).

---

## Etape 5 : Premier Deploy

### 5.1 Deployer

```bash
chmod +x scripts/deploy.sh scripts/sync-config.sh
./scripts/deploy.sh
```

Ce script fait automatiquement :
1. `npm ci` dans `functions/`
2. Sync des constantes partagees vers le frontend (`shared/constants.json` -> `web/public/constants.js`)
3. `firebase deploy --only hosting,functions,firestore`

Le deploy prend 2-5 minutes.

### 5.2 Configurer l'Interaction Endpoint Discord

Apres le deploy, recupere l'URL de ta Cloud Function :

```bash
firebase functions:list
```

Ou construis-la manuellement :
```
https://<REGION>-<PROJECT_ID>.cloudfunctions.net/discordInteraction
```

- [ ] Va sur **https://discord.com/developers/applications** > ton app > **General Information**
- [ ] Colle l'URL dans **"Interactions Endpoint URL"**
- [ ] Clique Save — Discord enverra un PING pour verifier. Si ca echoue, la fonction n'est pas encore deployee ou la verification de signature est cassee.

> **Erreur courante** : Discord refuse l'endpoint avec "Interactions Endpoint URL is not valid". Causes possibles :
> - La Cloud Function n'est pas deployee (verifie avec `gcloud functions list`)
> - La verification de signature (`tweetnacl`) n'est pas implementee dans la fonction
> - Le secret `discord-public-key` contient une mauvaise valeur

---

## Verification

### Frontend web

- [ ] Ouvre **`https://<PROJECT_ID>.web.app`** dans ton navigateur
- [ ] Le canvas 100x100 doit s'afficher

### API (curl)

```bash
# Recuperer l'etat du canvas
curl -s https://<PROJECT_ID>.web.app/api/canvas | head -c 200
```

### Firestore

- [ ] Va sur **https://console.firebase.google.com/project/<PROJECT_ID>/firestore**
- [ ] Verifie que la base existe et est accessible (elle sera vide tant qu'aucun pixel n'a ete place)

### Cloud Functions

```bash
# Lister les fonctions deployees
gcloud functions list --project=<PROJECT_ID>
```

Tu dois voir `placePixel`, `getCanvas`, et `discordInteraction`.

### Bot Discord

- [ ] Va sur ton serveur Discord de test
- [ ] Tape `/place` — la commande doit apparaitre dans l'autocompletion
- [ ] Tape `/info` — le bot doit repondre avec les infos du canvas

### Secret Manager

```bash
# Verifier que les secrets existent
gcloud secrets list --project=<PROJECT_ID>
```

Tu dois voir `discord-bot-token`, `discord-public-key`, `discord-app-id`.

---

## Recapitulatif des URLs utiles

| Quoi | URL |
|------|-----|
| GCP Console | https://console.cloud.google.com/home/dashboard?project=<PROJECT_ID> |
| Firebase Console | https://console.firebase.google.com/project/<PROJECT_ID> |
| Firestore | https://console.firebase.google.com/project/<PROJECT_ID>/firestore |
| Firebase Auth | https://console.firebase.google.com/project/<PROJECT_ID>/authentication |
| Discord Developer Portal | https://discord.com/developers/applications |
| Frontend deploye | https://<PROJECT_ID>.web.app |
| Cloud Functions logs | https://console.cloud.google.com/functions?project=<PROJECT_ID> |
| Secret Manager | https://console.cloud.google.com/security/secret-manager?project=<PROJECT_ID> |
