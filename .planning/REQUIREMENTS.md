# Requirements — Collaborative Pixel Canvas

## Requirements Fonctionnels

### RF-01: Canvas de pixels partage
- Un canvas de taille definie (ex: 100x100) avec une grille de pixels
- Chaque pixel a une position (x, y), une couleur, un auteur, et un timestamp
- Palette de couleurs predefinies (16 couleurs)
- Le canvas est persistant (survit aux redemarrages)

### RF-02: Placement de pixels
- Un utilisateur authentifie peut placer un pixel a une position (x, y) avec une couleur
- Le pixel ecrase le pixel precedent a cette position
- Validation: coordonnees dans les limites du canvas, couleur dans la palette
- Retour de confirmation ou d'erreur

### RF-03: Rate limiting
- Cooldown par utilisateur entre chaque placement (ex: 5 secondes)
- Le cooldown est partage entre Discord et Web (meme backend)
- Message d'erreur clair si cooldown actif (temps restant)

### RF-04: Bot Discord
- Fonctionne via Discord Interactions API (HTTP endpoint, pas de bot gateway)
- Slash commands:
  - `/place <x> <y> <couleur>` — place un pixel
  - `/canvas` — affiche le canvas actuel (image generee)
  - `/info` — affiche les infos du canvas (taille, nombre de pixels places, cooldown)
- Verification de signature Discord (ed25519)
- Identification de l'utilisateur par son Discord ID

### RF-05: Interface Web
- SPA hebergee sur Firebase Hosting
- Affichage du canvas en temps reel (HTML5 Canvas)
- Clic sur un pixel pour le placer (avec selection de couleur)
- Palette de couleurs interactive
- Indicateur de cooldown
- Zoom/scroll sur le canvas

### RF-06: Authentification
- **Web**: Firebase Auth (Google login ou connexion anonyme)
- **Discord**: identification automatique via Discord user ID
- Un utilisateur = un identifiant unique dans le systeme

### RF-07: Temps reel
- Les pixels places par n'importe quel utilisateur (Discord ou Web) apparaissent en temps reel sur l'interface web
- Utilisation des Firestore real-time listeners cote client
- Latence acceptable: < 2 secondes

### RF-08: Lecture du canvas
- API pour recuperer l'etat complet du canvas
- API pour recuperer une region du canvas (optimisation)
- Generation d'image du canvas pour la commande Discord `/canvas`

## Requirements Non-Fonctionnels

### RNF-01: 100% Serverless
- Aucune VM, aucun container gere manuellement
- Tous les composants sont des services manages GCP/Firebase
- Scale-to-zero quand inactif
- Pas de processus long-running (le Discord bot n'est PAS un bot WebSocket)

### RNF-02: Event-Driven Architecture
- Les composants communiquent via evenements (Pub/Sub, Eventarc)
- Le placement d'un pixel declenche un evenement
- Decouplage entre producteurs et consommateurs d'evenements

### RNF-03: Securite
- **IAM**: chaque Cloud Function a un service account dedie avec permissions minimales
- **Secrets**: tous les secrets (Discord token, etc.) dans Secret Manager, jamais en dur
- **Validation**: tous les inputs valides cote serveur (coordonnees, couleurs, auth)
- **Firestore Rules**: regles de securite pour empecher l'ecriture directe non autorisee
- **CORS**: configuration stricte sur les endpoints API

### RNF-04: Scalabilite
- Gestion de plusieurs utilisateurs concurrents sans conflits de donnees
- Firestore gere la concurrence nativement (transactions si necessaire)
- Cloud Functions scale horizontalement automatiquement
- Pas de goulot d'etranglement single-point-of-failure

### RNF-05: Qualite du Code
- Code modulaire et organise (separation concerns)
- Fonctions pures quand possible
- Gestion d'erreurs propre
- Nommage clair et coherent

### RNF-06: Documentation
- README avec instructions de setup completes (de zero a deploy)
- Diagramme d'architecture (composants + flux de donnees)
- Documentation des API endpoints
- Explication des choix d'architecture

## Requirements Bonus (si core termine)

### RB-01: Infrastructure as Code (Terraform)
- Tout le provisioning GCP via Terraform
- State remote dans Cloud Storage
- Modules reutilisables

### RB-02: Real-Time Streaming avance
- Server-Sent Events ou WebSocket via Cloud Run (si justifie)
- Ou Pub/Sub → push vers clients connectes

### RB-03: Advanced Monitoring
- Dashboards Cloud Monitoring personnalises
- Alertes sur erreurs/latence
- Logs structures avec Cloud Logging

### RB-04: Canvas "infini"
- Canvas extensible dynamiquement
- Chargement par chunks/regions
- Viewport virtuel sur le frontend

### RB-05: Advanced Web UX
- Zoom fluide, pan, minimap
- Historique des pixels (qui a place quoi)
- Heatmap d'activite
- Mode spectateur

### RB-06: Multi-canvas
- Plusieurs canvas actifs simultanement
- Selection du canvas sur Discord et Web
