# NeuroKid

> Application web d'évaluation cognitive adaptative pour les enfants de 7 à 12 ans.
> Projet d'études Bachelor 2 — Sup de Vinci, promotion 2025-2026.

NeuroKid propose à un enfant un parcours de questions qui s'ajuste **en temps réel**
à ses performances. Un moteur prédictif `scikit-learn` recalibre la difficulté à
chaque réponse pour maintenir l'enfant dans sa zone de progression, sur trois
domaines cognitifs : **mémoire**, **logique & raisonnement**, **attention &
concentration**. Un module d'administration permet d'enrichir la banque de
questions, manuellement ou via un LLM (Google Gemini par défaut).

---

## Sommaire

- [Aperçu rapide](#aperçu-rapide)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Pré-requis](#pré-requis)
- [Lancement local en une commande](#lancement-local-en-une-commande)
- [URLs et identifiants](#urls-et-identifiants)
- [Variables d'environnement](#variables-denvironnement)
- [Commandes utiles](#commandes-utiles)
- [Structure du dépôt](#structure-du-dépôt)
- [Endpoints principaux](#endpoints-principaux)
- [Modèle de données](#modèle-de-données)
- [Moteur IA](#moteur-ia)
- [Génération de questions par LLM](#génération-de-questions-par-llm)
- [Sécurité et RGPD](#sécurité-et-rgpd)
- [Dépannage](#dépannage)
- [Déploiement 3 VM](#déploiement-3-vm)
- [Équipe](#équipe)

---

## Aperçu rapide

```
┌──────────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│  Front Angular 20    │ ──▶ │  API Flask        │ ──▶ │  MariaDB 11        │
│  http://localhost:4200│     │  http://localhost │     │  cognitive_        │
│  (Nginx + SPA)       │     │       :5000       │     │  assessment        │
└──────────────────────┘     │  scikit-learn     │     └────────────────────┘
                             │  + LLM (Gemini)   │             ▲
                             └───────────────────┘             │
                                                       phpMyAdmin :8080
```

Tout démarre avec **un seul `docker compose up`**.

---

## Stack technique

| Couche               | Technologie                              | Rôle                                                       |
|----------------------|------------------------------------------|------------------------------------------------------------|
| Front-end            | Angular 20 + TypeScript                  | SPA, parcours enfant, dashboard admin                      |
| Reverse proxy front  | nginx (image alpine)                     | Sert l'app Angular buildée + injecte la config runtime     |
| Back-end / API       | Python 3.12 + Flask + Gunicorn           | API REST, logique métier, contrôle d'accès                 |
| IA prédictive        | scikit-learn (RandomForest + GBT)        | Recalibrage de la difficulté à chaque réponse              |
| Génération questions | LLM compatible OpenAI (Gemini 2.5 Flash) | Création semi-automatique de questions QCM                 |
| Base de données      | MariaDB 11                               | Utilisateurs, enfants, sessions, banque de questions       |
| Admin BDD            | phpMyAdmin 5                             | Inspection / debug en local                                |
| Conteneurisation     | Docker + Docker Compose                  | Reproductibilité et orchestration locale et VM             |
| Sécurité             | bcrypt, CORS strict, `X-User-Id`         | Authentification, isolation des rôles, en-têtes durcis     |

---

## Architecture

### Version locale (ce dépôt)

Un seul `docker-compose.yml` à la racine assemble les 4 services :

- `db` — MariaDB
- `phpmyadmin` — admin BDD
- `api` — Flask + scikit-learn
- `front` — nginx servant le build Angular

Tous les conteneurs partagent un réseau Docker interne (`neurokidnet`) et
communiquent par leurs noms de service (`db`, `api`).

### Version laboratoire (3 VM)

Pour la soutenance et le déploiement dans le réseau Sup de Vinci, l'app
est éclatée sur 3 VM Linux derrière un firewall OPNsense :

| VM        | IP fixe          | Rôle                                  |
|-----------|------------------|---------------------------------------|
| Routeur   | 192.168.10.1     | OPNsense (passerelle)                 |
| Front     | 192.168.10.20    | nginx + Angular                       |
| Back      | 192.168.10.10    | Flask + scikit-learn + LLM proxy      |
| BDD       | 192.168.10.30    | MariaDB + phpMyAdmin (local-only)     |

Chaque VM a son propre `docker-compose.yml` dans `neurokid-front/`,
`neurokid-back/` et `neurokid-db/`.

---

## Pré-requis

- **Docker Desktop** lancé (Windows / macOS) ou **Docker Engine** + Compose v2 (Linux)
- Ports libres sur la machine hôte : **3307**, **4200**, **5000**, **8080**
- Connexion internet pour récupérer les images au premier `up`
- (Optionnel) Une clé Gemini gratuite pour la génération de questions :
  https://aistudio.google.com/apikey

> Sous Windows : si MariaDB ou MySQL est installé en service local, le port
> 3306 est déjà pris. C'est pour ça que la BDD est exposée sur **3307** côté hôte.

---

## Lancement local en une commande

```bash
# Cloner le dépôt
git clone https://github.com/Raphael-Jolivel/Neurokid.git
cd Neurokid

# Démarrer toute la stack (build + run en arrière-plan)
docker compose up -d --build
```

La première exécution prend ~2 minutes (build de l'image Python + build
Angular). Les suivantes sont instantanées.

Vérifier l'état :

```bash
docker compose ps
docker compose logs -f api          # logs de l'API uniquement
```

L'API est prête quand `curl http://localhost:5000/health` renvoie `{"status":"ok"}`.

---

## URLs et identifiants

| Service           | URL                                  | Identifiants        |
|-------------------|--------------------------------------|---------------------|
| Front Angular     | http://localhost:4200                | `admin` / `admin123`|
| API Flask         | http://localhost:5000/health         | —                   |
| phpMyAdmin        | http://localhost:8080                | `root` / `root`     |
| MariaDB (host)    | `localhost:3307`                     | `root` / `root`     |

> Le compte `admin / admin123` est créé automatiquement par `01-init.sql`.
> Tous les mots de passe sont volontairement triviaux **uniquement pour la
> version locale**. La version 3 VM utilise des secrets dédiés.

---

## Variables d'environnement

Toutes les valeurs sont déjà définies dans `.env` à la racine. Les principales :

```ini
# MariaDB
MARIADB_ROOT_PASSWORD=root
MARIADB_DATABASE=cognitive_assessment

# API Flask
DB_HOST=db                  # nom du service Docker (pas localhost)
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=cognitive_assessment
CORS_ORIGINS=http://localhost:4200,http://localhost

# Ports exposés sur l'hôte
DB_PORT_HOST=3307
PHPMYADMIN_PORT=8080
API_PORT=5000
FRONT_PORT=4200

# LLM (Gemini par défaut, gratuit)
LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
LLM_MODEL=gemini-2.5-flash
```

> **Important :** la clé d'API LLM **n'est pas stockée** dans le `.env`. Elle
> est saisie côté admin dans le navigateur, transmise via l'en-tête HTTP
> `X-OpenAI-Key` à chaque requête de génération, jamais persistée.

---

## Commandes utiles

```bash
# Voir l'état
docker compose ps

# Suivre tous les logs
docker compose logs -f

# Redémarrer un service (ex: après modif code)
docker compose restart api
docker compose up -d --build api    # forcer un rebuild

# Entrer dans le conteneur API
docker exec -it neurokid-api sh

# Entrer dans MariaDB
docker exec -it neurokid-db mariadb -uroot -proot

# Tout arrêter (garde les données BDD)
docker compose down

# Tout arrêter ET supprimer les données (réinit complète)
docker compose down -v
```

---

## Structure du dépôt

```
Neurokid/
├── docker-compose.yml          # orchestrateur LOCAL (les 4 services)
├── README-LOCAL.md             # mémo court pour test local
├── README.md                   # ce fichier
│
├── neurokid-front/             # SPA Angular 20
│   ├── src/                    # code TypeScript / templates / styles
│   ├── public/config.json      # config runtime (URL API)
│   ├── nginx.conf              # config du reverse proxy front
│   ├── docker-compose.yml      # variante "front seul" pour la VM Front
│   └── Dockerfile              # build multi-stage Angular -> nginx
│
├── neurokid-back/              # API REST Flask + IA
│   ├── neurokid_api/
│   │   ├── app.py              # routes utilisateur (register/login/sessions)
│   │   ├── admin_routes.py     # routes administrateur (rôle = admin)
│   │   ├── db.py               # pool de connexions MariaDB
│   │   ├── predictor.py        # adaptateur scikit-learn
│   │   ├── model/              # modèle pré-entraîné (joblib)
│   │   ├── cognitive_assessment.sql   # schéma + seed
│   │   └── Dockerfile
│   ├── proxy/nginx.conf        # reverse proxy Back (VM)
│   └── docker-compose.yml      # variante "back seul" pour la VM Back
│
└── neurokid-db/                # MariaDB + phpMyAdmin pour la VM BDD
    ├── sql/01-init.sql         # création tables + admin par défaut
    ├── sql/02-migrate-*.sql    # migration BDD existante
    └── docker-compose.yml      # variante "db seule" pour la VM BDD
```

---

## Endpoints principaux

L'API expose deux familles de routes : **utilisateur** (parents et enfants) et
**administrateur** (préfixe `/admin/`, rôle `admin` requis). L'authentification
se fait via en-tête HTTP `X-User-Id` retourné au moment du `/login`.

### Espace utilisateur

| Méthode | Route                          | Description                                   |
|---------|--------------------------------|-----------------------------------------------|
| POST    | `/register`                    | Création de compte (hash bcrypt)              |
| POST    | `/login`                       | Authentification, retourne `user_id`          |
| POST    | `/forgotten-password`          | Génère un `reset_token` temporaire            |
| POST    | `/session/start`               | Démarre une session adaptative                |
| GET     | `/session/<sid>/question`      | Question suivante recalibrée par l'IA         |
| POST    | `/session/<sid>/answer`        | Soumet une réponse, ajuste la difficulté      |
| GET     | `/session/<sid>/score`         | Score final + label cognitif                  |
| GET     | `/children/<id>/history`       | Historique des sessions d'un enfant           |

### Module administrateur (rôle = admin)

| Méthode  | Route                             | Description                                |
|----------|-----------------------------------|--------------------------------------------|
| GET      | `/admin/overview`                 | KPI : utilisateurs, sessions, questions    |
| GET      | `/admin/users`                    | Liste des comptes                          |
| POST     | `/admin/users/<id>/anonymize`     | Effacement RGPD à la demande               |
| GET      | `/admin/sessions`                 | Suivi des sessions terminées               |
| DELETE   | `/admin/sessions/<sid>`           | Suppression d'une session                  |
| GET·POST | `/admin/questions`                | Lecture et création (CRUD)                 |
| PUT·DEL  | `/admin/questions/<id>`           | Édition et suppression unitaires           |
| POST     | `/admin/questions/generate`       | Proxy LLM (clé éphémère `X-OpenAI-Key`)    |

### Health-check

`GET /health` → `{"status": "ok"}` quand l'API est prête.

---

## Modèle de données

Trois tables principales dans la base `cognitive_assessment` :

- **`users`** — comptes parents / admin (id, email, hash bcrypt, role, …)
- **`question_bank`** — questions avec `domain` (memory / logic / attention),
  `difficulty` (1-5), énoncé, choix, bonne réponse, métadonnées
- **`sessions`** — parcours d'un enfant : id, user_id, domaine, score,
  réponses détaillées (JSON), timestamps
- **`ai_predictions`** — trace des décisions du modèle (entrée / sortie / score)
  pour audit et explicabilité

Le schéma complet est dans `neurokid-db/sql/01-init.sql` (créé automatiquement
au premier `docker compose up`).

---

## Moteur IA

Côté API, `predictor.py` charge un modèle scikit-learn pré-entraîné
(`model/cognitive_model.joblib`) qui prédit la probabilité de réussite à la
prochaine question, à partir de **7 features** :

```
age, domain_enc, difficulty_enc, response_time_sec,
answer_correct, partial_score, attempts
```

À chaque réponse, l'API recalcule cette probabilité :

- **`p ≥ 0.75`** → on monte la difficulté d'un cran
- **`p ≤ 0.25`** → on baisse la difficulté d'un cran
- entre les deux → on reste au même niveau

L'objectif est de garder l'enfant **dans sa zone de développement proximal** :
ni trop facile (ennui), ni trop dur (découragement).

Le modèle peut être ré-entraîné hors-ligne sur un export des sessions ; le
script et les notebooks d'entraînement ne sont pas embarqués dans l'image
runtime pour garder Docker léger.

---

## Génération de questions par LLM

L'admin peut générer des questions en lot via `/admin/questions/generate`.
Le pipeline :

1. L'admin entre sa **clé API LLM** dans le navigateur (Gemini ou OpenAI).
2. Le front la transmet à l'API uniquement via l'en-tête `X-OpenAI-Key`,
   **jamais via le corps ni les logs**.
3. L'API construit un prompt structuré (domaine + niveau + nb de questions)
   et appelle le endpoint compatible OpenAI configuré dans `LLM_URL`.
4. La réponse JSON est validée puis insérée dans `question_bank` avec un
   flag `source = 'llm'` pour traçabilité.

Par défaut, **Gemini 2.5 Flash** est utilisé (gratuit, rapide). Pour basculer
sur OpenAI, il suffit de changer `LLM_URL` et `LLM_MODEL` dans `.env` :

```ini
LLM_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
```

Le code applicatif n'a pas besoin d'être modifié : on parle un seul protocole.

---

## Sécurité et RGPD

- **Mots de passe** : hash bcrypt (coût 12), jamais stockés en clair
- **Authentification** : en-tête HTTP `X-User-Id` retourné au login,
  vérification serveur à chaque requête sensible
- **Autorisation admin** : contrôle `role = 'admin'` côté Flask
  sur toutes les routes `/admin/*`
- **CORS strict** : seules les origines listées dans `CORS_ORIGINS` sont autorisées
- **Reverse-proxy nginx** : timeouts, headers durcis, taille de body limitée
- **phpMyAdmin** : exposé uniquement sur l'hôte local (jamais sur le LAN en prod)
- **Clé LLM éphémère** : transmise par en-tête, jamais persistée
- **RGPD** : route `/admin/users/<id>/anonymize` qui pseudonymise un compte
  et purge ses données identifiantes sans casser les agrégats analytiques

---

## Dépannage

### `502 Bad Gateway` sur l'API

L'API n'a pas réussi à se connecter à la BDD. À vérifier dans l'ordre :

```bash
docker compose ps                       # api restartting / unhealthy ?
docker compose logs api --tail=80       # cherche "Access denied" ou "connect"
docker compose logs db --tail=20        # MariaDB est-il "healthy" ?
```

### `Access denied for user 'X'@'%' to database 'cognitive_assessment'`

L'utilisateur n'a pas les droits, ou la base n'est pas initialisée.
Réinitialisation propre :

```bash
docker compose down -v       # supprime aussi le volume db-data
docker compose up -d --build
```

`01-init.sql` recrée la base et l'utilisateur avec les bons grants.

### `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`

Docker Desktop n'est pas démarré. Lance-le et attends que la baleine soit
verte (« Engine running »).

### Port déjà utilisé

```bash
# Windows
netstat -ano | findstr :4200
# macOS / Linux
lsof -i :4200
```

Tue le service qui squatte le port, ou change la valeur dans `.env`
(`FRONT_PORT`, `API_PORT`, `PHPMYADMIN_PORT`, `DB_PORT_HOST`).

### Reset complet (BDD + images)

```bash
docker compose down -v
docker system prune -af --volumes     # ATTENTION : supprime tes autres images Docker
```

---

## Déploiement 3 VM

Pour rejouer la configuration laboratoire (front, back et BDD sur 3 VM
distinctes derrière OPNsense) :

1. Sur chaque VM, cloner uniquement le dossier correspondant
   (`neurokid-front/`, `neurokid-back/` ou `neurokid-db/`).
2. Adapter le `.env` de chaque dossier avec les **IP fixes** des autres VM
   (`DB_HOST=192.168.10.30`, `API_URL=http://192.168.10.10`, etc.).
3. Sur OPNsense, n'ouvrir que les ports nécessaires :
   - Front (192.168.10.20) → ports 80/443
   - Back (192.168.10.10) → port 80 (proxy nginx)
   - BDD (192.168.10.30) → port 3306 **uniquement depuis la VM Back**
4. Sur la VM BDD, créer l'utilisateur applicatif et charger le schéma :

   ```bash
   docker exec -it neurokid-db mariadb -uroot -proot
   ```
   ```sql
   CREATE USER IF NOT EXISTS 'neurokid'@'%' IDENTIFIED BY '<motdepasse>';
   GRANT ALL PRIVILEGES ON cognitive_assessment.* TO 'neurokid'@'%';
   FLUSH PRIVILEGES;
   ```

5. Lancer dans cet ordre : `db` → `back` → `front`.

Les `docker-compose.yml` de chaque dossier sont déjà préparés pour ce mode.

---

## Équipe

Projet réalisé en groupe à Sup de Vinci, promotion Bachelor 2 :

- Raphaël Jolivel-Savage
- Ethan Ménoury
- Yanick Mbaihingabe
- Edouard Vallet
- Kephas Assogba

Encadrement pédagogique Sup de Vinci · Année 2025-2026.

---

## Licence

Projet d'études — usage pédagogique. Reproduction interdite sans autorisation
des auteurs.
