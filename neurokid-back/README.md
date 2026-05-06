# NeuroKid - VM Back (API)

Stack Docker à déployer sur la **VM Back** du labo. Elle contient :

- l'API Flask (`neurokid_api/`) servie par **gunicorn**
- un **reverse proxy nginx** local exposant `/api/...` et `/health`

La base de données est sur une autre VM (cf. dépôt `neurokid-db`).
Le front Angular est sur une 3e VM (branche `front` du repo).

```
navigateur ─► http://VM_BACK/api/login   ──► proxy nginx (80)
                                              │
                                              ▼
                                        api:5000  (Flask)
                                              │
                                              ▼
                                       VM_DB:3306  (MariaDB)
```

## Pré-requis sur la VM

- Docker Engine 24+ et Docker Compose v2
- Accès réseau (VPN école) à la VM DB sur le port 3306
- Le port 80 disponible sur la VM

## Premier déploiement

```bash
# 1) Récupérer le code (branche back)
git clone -b back https://github.com/<user>/<repo>.git neurokid-back
cd neurokid-back

# 2) Renseigner les variables
cp .env.example .env
nano .env          # mettre l'IP de la VM DB, le mot de passe, l'URL du front

# 3) Construire et démarrer
docker compose up -d --build

# 4) Vérifier
curl http://localhost/health
# => {"status":"ok","db":"up"}
```

## Mises à jour (déploiement manuel)

Les VMs ne sont pas joignables depuis Internet : on déploie à la main.

```bash
cd ~/neurokid-back
git pull
docker compose up -d --build
```

## Variables d'environnement

| Variable        | Description                                      | Exemple                |
|-----------------|--------------------------------------------------|------------------------|
| `DB_HOST`       | IP/hostname de la VM DB                          | `10.18.60.25`          |
| `DB_PORT`       | Port MariaDB                                     | `3306`                 |
| `DB_USER`       | Utilisateur applicatif (pas root)                | `neurokid`             |
| `DB_PASSWORD`   | Mot de passe                                     | `...`                  |
| `DB_NAME`       | Nom de la base                                   | `cognitive_assessment` |
| `CORS_ORIGINS`  | Origine autorisée (URL VM Front)                 | `http://10.18.60.24`   |
| `HTTP_PORT`     | Port exposé par le proxy (défaut 80)             | `80`                   |

## Points d'API exposés via le proxy

- `GET  /health`               santé applicative + ping DB
- `POST /api/register`         création de compte enfant
- `POST /api/login`            authentification
- `POST /api/session/start`
- `GET  /api/session/{sid}/question`
- `POST /api/session/{sid}/answer`
- `GET  /api/session/{sid}/score`
- `GET  /api/session/{sid}/status`
- `GET  /api/children`
- `GET  /api/children/{id}/history`
- `GET  /api/model/info`
- `POST /api/model/retrain`

### Endpoints administrateur

Toutes les routes sous `/api/admin/*` exigent un en-tête
`X-User-Id: <id>` où l'utilisateur correspondant a `role='admin'`.
La génération IA exige en plus un en-tête `X-OpenAI-Key: sk-...`.
Ce token n'est **jamais persisté côté serveur** : il transite par
requête, le front le stocke dans le `localStorage` du navigateur.

- `GET    /api/admin/overview`               compteurs globaux
- `GET    /api/admin/users`                  liste des comptes
- `POST   /api/admin/users/{id}/anonymize`   RGPD : vide nom/username/password, conserve sessions
- `GET    /api/admin/sessions`               toutes les sessions
- `DELETE /api/admin/sessions/{sid}`         supprime une session (et ses réponses)
- `GET    /api/admin/questions`              banque de questions (filtres: domain, difficulty)
- `POST   /api/admin/questions`              création manuelle
- `PUT    /api/admin/questions/{id}`         mise à jour
- `DELETE /api/admin/questions/{id}`         suppression (409 si déjà répondue)
- `POST   /api/admin/questions/generate`     proxy OpenAI gpt-4o-mini, renvoie une question (non sauvegardée)

Compte admin par défaut créé par le SQL : `admin / admin123`.
À changer après le premier login en réutilisant la fonction de
réinitialisation de mot de passe.

## Sécurité

- Conteneurs en utilisateur non-root (UID 1000).
- CORS verrouillé sur la VM Front via `CORS_ORIGINS`.
- En-têtes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- API non exposée directement : seul le proxy ouvre le port 80.
- `.env` jamais commit (cf. `.gitignore`).

## Logs et debug

```bash
docker compose logs -f api
docker compose logs -f proxy
docker compose ps
docker compose exec api sh
```

## Arrêt complet

```bash
docker compose down
```
