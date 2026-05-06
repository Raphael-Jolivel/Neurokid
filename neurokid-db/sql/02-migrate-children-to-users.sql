-- ================================================================
-- MIGRATION : children -> users + colonne role
-- ================================================================
-- À jouer UNE SEULE FOIS sur une BDD qui a déjà la table `children`
-- (ancien schéma). NE PAS jouer si la BDD a été créée avec le
-- nouveau 01-init.sql, qui crée déjà `users` directement.
--
-- Usage côté VM DB :
--   docker compose exec -T db mariadb -u root -p$MARIADB_ROOT_PASSWORD \
--     cognitive_assessment < sql/02-migrate-children-to-users.sql
-- ================================================================

USE cognitive_assessment;

-- 1) Renommer la table
RENAME TABLE children TO users;

-- 2) Ajouter la colonne role (par défaut 'child' pour tous les comptes existants)
ALTER TABLE users
    ADD COLUMN role ENUM('child', 'admin') NOT NULL DEFAULT 'child' AFTER password;

-- 3) Permettre age=NULL pour les comptes admin (les admins n'ont pas d'âge 7-12)
ALTER TABLE users
    MODIFY COLUMN age TINYINT NULL;
-- Note : la contrainte CHECK est conservée mais ne s'applique qu'aux valeurs
--        non-NULL (comportement standard SQL).

-- 4) Ajouter colonnes source + created_at à question_bank si absentes
ALTER TABLE question_bank
    ADD COLUMN IF NOT EXISTS source     ENUM('seed', 'admin', 'ai') NOT NULL DEFAULT 'seed',
    ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 5) Créer un compte admin par défaut (mdp "admin123" - À CHANGER ENSUITE)
INSERT INTO users (name, age, username, password, role)
SELECT 'Administrateur', NULL, 'admin',
       '$2b$12$QL6OycLCI7m6eZUMXHjYl.db5GP2UWZ7G.45qr7kh0MO/jUIciva.',
       'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- 6) Vérifier
SELECT id, username, role, created_at FROM users WHERE role = 'admin';
SELECT 'Migration terminée. Compte admin = admin / admin123 (À CHANGER).' AS info;
