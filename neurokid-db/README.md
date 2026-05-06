# NeuroKid - VM Base de données

Stack Docker à déployer sur la **VM Database** du labo. Elle contient :

- **MariaDB 11** (compatible avec le driver `mysql-connector-python` côté API)
- **phpMyAdmin** pour l'administration via navigateur

> Migration MySQL → MariaDB : aucune modification du schéma SQL n'est
> nécessaire. Les types `JSON`, les contraintes `CHECK` et l'encodage
> `utf8mb4` sont supportés depuis MariaDB 10.2.

## Pré-requis sur la VM

- Docker Engine 24+ et Docker Compose v2
- Accès réseau (VPN école) ouvert sur les ports 3306 et 8080
- Volume disque suffisant pour `db-data` (~1 Go suffit pour le projet)

## Premier déploiement

```bash
# 1) Récupérer le code (dépôt DB séparé ou sous-dossier)
git clone <url-du-repo-db>
cd neurokid-db

# 2) Renseigner les secrets
cp .env.example .env
nano .env

# 3) Démarrer
docker compose up -d

# 4) Vérifier
docker compose ps
docker compose logs -f db
# Le script sql/01-init.sql s'exécute automatiquement au premier boot.
```

Le schéma `cognitive_assessment` est rempli par `sql/01-init.sql` à la
toute première création du volume `db-data`. Si vous changez le schéma
ensuite, soit jouez le SQL manuellement via phpMyAdmin, soit faites un
`docker compose down -v` pour repartir de zéro (DESTRUCTIF).

## Module Administrateur (mai 2026)

Depuis l'ajout de l'interface admin, la table `children` est renommée
en `users` et reçoit une colonne `role ENUM('child','admin')`. La table
`question_bank` reçoit deux colonnes : `source ENUM('seed','admin','ai')`
et `created_at`. Un compte admin par défaut est créé :

- **username** : `admin`
- **password** : `admin123` (à changer après le premier login)

Deux scénarios :

**a) Nouveau déploiement** (volume `db-data` vide) :
`sql/01-init.sql` s'exécute automatiquement, le schéma est correct dès
le départ.

**b) Base existante** : jouer une seule fois la migration
`sql/02-migrate-children-to-users.sql` via phpMyAdmin ou en CLI :

```bash
docker compose exec -T db sh -c \
  'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" cognitive_assessment' \
  < sql/02-migrate-children-to-users.sql
```

## Accès

- **MariaDB**       : `<IP_VM_DB>:3306` (utilisateur défini dans `.env`)
- **phpMyAdmin**    : `http://<IP_VM_DB>:8080`

Depuis la VM Back, dans son `.env` :

```
DB_HOST=<IP_VM_DB>
DB_PORT=3306
DB_USER=neurokid
DB_PASSWORD=<celui défini ici>
DB_NAME=cognitive_assessment
```

## Sécurité

- Le port 3306 ne doit être joignable QUE depuis le VPN école.
  Vérifier la configuration vSphere / firewall au besoin.
- Ne jamais utiliser `root` côté API : on a créé un utilisateur
  applicatif (`MARIADB_USER`) avec accès uniquement à la base
  `cognitive_assessment`.
- En production, désactiver phpMyAdmin (commenter le bloc dans
  `docker-compose.yml`) ou le restreindre par un VPN/IP.

## Sauvegardes

```bash
# Dump complet
docker compose exec db sh -c \
  'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" cognitive_assessment' \
  > backup-$(date +%F).sql

# Restauration
cat backup-2026-05-04.sql | docker compose exec -T db sh -c \
  'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" cognitive_assessment'
```

## Mise à jour

```bash
cd ~/neurokid-db
git pull
docker compose pull        # récupère la dernière image MariaDB 11
docker compose up -d
```

## Arrêt

```bash
docker compose down            # garde le volume (= les données)
docker compose down -v         # SUPPRIME les données (à manier avec précaution)
```
