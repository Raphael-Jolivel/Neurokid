# NeuroKid - Lancement LOCAL (1 commande)

Cette version regroupe les 3 stacks (db + back + front) dans **un seul
`docker-compose.yml`** pour pouvoir tout lancer d'un coup en local sur
votre Windows, sans avoir à toucher à 3 fichiers `.env` differents.

> Pour le déploiement sur les VMs du labo, on revient aux 3 dossiers
> séparés (chacun avec son propre `.env` et `docker-compose.yml`).

## Pré-requis

- **Docker Desktop** lancé
- Les ports 3306, 4200, 5000, 8080 libres sur Windows
  (sinon : `netstat -ano | findstr :3306` puis tuer le service ;
  ou modifier les ports dans `.env`)

## Identifiants

Tout est en `root / root` pour simplifier le test local :

- **MariaDB**       : `root / root`
- **phpMyAdmin**    : `root / root`
- **Compte admin de l'app** (créé par le SQL) : `admin / admin123`

## Lancer

Dans PowerShell, depuis le dossier `NeuroKid` :

```powershell
docker compose up -d --build
```

La première fois, ça va builder les images (~2 min : Python +
node + Angular). Ensuite c'est instantané.

Pour voir l'état :

```powershell
docker compose ps
docker compose logs -f          # logs de tout, Ctrl+C pour quitter
docker compose logs -f api      # juste l'API Flask
```

## URLs

| Service          | URL                                | Identifiants     |
|------------------|------------------------------------|------------------|
| Front Angular    | http://localhost:4200              | admin / admin123 |
| API Flask        | http://localhost:5000/health       | -                |
| phpMyAdmin       | http://localhost:8080              | root / root      |

> En local, Flask est appelé DIRECTEMENT sur le port 5000, donc
> SANS prefixe `/api` (ce prefixe n'existe que via le proxy nginx
> qui sera mis en place sur la VM de prod).

## Tester rapidement

```powershell
# 1. L'API répond
curl http://localhost:5000/health

# 2. Login admin
curl -X POST http://localhost:5000/login `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"admin\",\"password\":\"admin123\"}'
```

## Workflow admin

1. http://localhost:4200 -> Connexion `admin / admin123`
2. Redirection automatique vers `/admin`
3. Aller dans **Générateur**, coller votre token OpenAI (sk-...),
   cliquer **Enregistrer** (stocké dans le navigateur uniquement)
4. Choisir un domaine, **Générer**, ajuster la difficulté, **Valider**
5. La question apparaît dans **Questions** avec source `ai`

## Réinitialiser la BDD

Si vous voulez repartir de zéro (volume effacé, SQL d'init rejoué) :

```powershell
docker compose down -v
docker compose up -d --build
```

## Tout arrêter

```powershell
docker compose down            # garde les données
docker compose down -v         # supprime le volume BDD aussi
```

## Pourquoi des `.env` séparés dans les sous-dossiers ?

Les sous-dossiers `neurokid-back/`, `neurokid-db/`, `neurokid-front/`
ont chacun leur propre `docker-compose.yml` et `.env.example` qui
servent UNIQUEMENT au déploiement labo (3 VMs). Pour le test local,
on n'utilise que **le compose racine + le .env racine**.
