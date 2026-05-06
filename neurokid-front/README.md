# NeuroKid - VM Front (Angular)

Front-end Angular 20 (standalone, UIKit) du projet NeuroKid.
Style neutre type *Duolingo simplifié*, sans emojis, en français.

Cette stack tourne sur la **VM Front** du labo. Elle contient :

- l'application Angular construite par Vite/`@angular/build`
- un **nginx 1.27** servant le bundle statique en SPA-fallback

```
navigateur ─► http://VM_FRONT/         (nginx + Angular)
navigateur ─► http://VM_BACK/api/...   (appelée par le JS)
```

L'URL de l'API est lue dynamiquement dans `/config.json`, généré au
démarrage du conteneur à partir de la variable `API_URL`. On construit
donc l'image **une seule fois** et on la redéploie sur tous les
environnements en passant simplement la bonne URL.

---

## 1. Lancement local (développement)

Sans Docker :

```bash
npm install
npm start
# http://localhost:4200
```

Le fichier `public/config.json` contient `apiUrl: "http://localhost:5000"`
qui est utilisé par défaut en `ng serve`.

---

## 2. Déploiement Docker sur la VM Front

### Pré-requis sur la VM

- Docker Engine 24+ et Docker Compose v2
- Accès réseau (VPN école) à la VM Back sur le port 80

### Premier déploiement

```bash
# 1) Récupérer le code (branche front)
git clone -b front https://github.com/<user>/<repo>.git neurokid-front
cd neurokid-front

# 2) Renseigner les variables
cp .env.example .env
nano .env          # mettre l'URL publique de la VM Back, ex: http://10.18.60.23/api

# 3) Construire et démarrer
docker compose up -d --build

# 4) Vérifier
curl http://localhost/healthz
# => ok
```

### Mises à jour (déploiement manuel)

```bash
cd ~/neurokid-front
git pull
docker compose up -d --build
```

---

## 3. Variables d'environnement

| Variable      | Description                                                       | Exemple                  |
|---------------|-------------------------------------------------------------------|--------------------------|
| `API_URL`     | URL **publique** de la VM Back appelée par le navigateur          | `http://10.18.60.23/api` |
| `HTTP_PORT`   | Port HTTP exposé par nginx (défaut 80)                            | `80`                     |

> `API_URL` doit pointer vers l'URL telle qu'elle est joignable
> **depuis le navigateur de l'utilisateur** (pas depuis le conteneur).
> Comme tout le monde est sur le VPN école, c'est l'IP/URL de la VM Back.

---

## 4. Architecture du front

```
src/
├── index.html              -> Inter, UIKit CDN
├── styles.scss             -> palette Duolingo, .level-* / .diff-*
├── main.ts                 -> charge /config.json puis bootstrap
└── app/
    ├── app.config.ts       -> provideHttpClient + provideRouter
    ├── app.routes.ts       -> 9 routes
    ├── environments/
    │   └── environment.ts  -> { production, apiUrl } MUTABLE
    ├── classes/            -> User, Session
    ├── services/           -> auth / session / child / model / notification
    ├── guards/             -> authGuard
    ├── components/footer/  -> footer commun
    └── pages/              -> sign-in, sign-up, home, quiz, report, etc.
```

---

## 5. Configuration runtime

Le pattern utilisé permet de bâtir l'image **une seule fois** :

1. Au démarrage du conteneur, `docker-entrypoint.sh` génère
   `/usr/share/nginx/html/config.json` à partir de `API_URL`.
2. nginx sert ce fichier avec `Cache-Control: no-store`.
3. `main.ts` fait un `fetch('/config.json')` et écrase
   `environment.apiUrl` avant le `bootstrapApplication`.
4. Tous les services (`auth`, `child`, `session`, `model`) lisent
   directement `environment.apiUrl`.

Pour tester en local sans Docker, le fichier `public/config.json`
fournit un défaut.

---

## 6. Style

- **Police** : Inter (Google Fonts) - chargée dans `index.html`
- **UI Kit** : UIKit 3.17.11 (CDN)
- Pas d'emojis, en français.

---

## 7. Logs et debug

```bash
docker compose logs -f web
docker compose ps
docker compose exec web sh
```

## 8. Arrêt

```bash
docker compose down
```

---

## 9. Module Administrateur

L'authentification distingue deux rôles : `child` (par défaut) et
`admin`. Après connexion, un administrateur est redirigé vers
`/admin` et accède à 5 pages protégées par `adminGuard` :

- `/admin`            : tableau de bord (compteurs)
- `/admin/users`      : liste des utilisateurs + bouton **Anonymiser** (RGPD)
- `/admin/sessions`   : liste des sessions + bouton **Supprimer**
- `/admin/questions`  : CRUD sur la banque de questions
- `/admin/generate`   : génération via l'API OpenAI

**Compte admin par défaut** (créé par le SQL) :
`admin / admin123` - à changer après le premier login.

**Token OpenAI** : il est saisi dans la page Generator, stocké dans
`localStorage` (clé `openai_api_key`) et transmis à chaque requête via
l'en-tête `X-OpenAI-Key`. Le token n'est **jamais persisté sur le
serveur**.

**Workflow de génération** : on génère 1 question à la fois, l'IA
suggère une difficulté, l'humain peut la modifier, puis valide pour
sauvegarder en base (`source='ai'`) ou rejette pour repartir.

Bachelor 2 - Projet d'études 2025/26.
