-- ================================================================
-- NeuroKid - schéma initial
-- ================================================================
-- Joué une seule fois, à la création du volume db-data.
-- Pour une BDD existante (rename children -> users), utiliser le
-- script 02-migrate-children-to-users.sql.
-- ================================================================

CREATE DATABASE IF NOT EXISTS cognitive_assessment
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cognitive_assessment;

-- ----------------------------------------------------------------
-- Comptes utilisateurs (enfants testés + admins)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    age                 TINYINT NULL CHECK (age IS NULL OR age BETWEEN 7 AND 12),
    username            VARCHAR(100) NOT NULL UNIQUE,
    password            VARCHAR(255) NOT NULL,
    role                ENUM('child', 'admin') NOT NULL DEFAULT 'child',
    reset_token         VARCHAR(255) DEFAULT NULL,
    reset_token_expires DATETIME DEFAULT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- Sessions de quiz
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id              VARCHAR(36) PRIMARY KEY,
    child_id        INT NOT NULL,
    status          ENUM('in_progress', 'complete') DEFAULT 'in_progress',
    overall_score   FLOAT DEFAULT NULL,
    overall_level   VARCHAR(20) DEFAULT NULL,
    started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at     DATETIME DEFAULT NULL,
    FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- Banque de questions (validées + créées par admin)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_bank (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    domain          ENUM('Memory', 'Logic & Reasoning', 'Attention & Focus') NOT NULL,
    difficulty      ENUM('easy', 'medium', 'hard') NOT NULL,
    question_text   TEXT NOT NULL,
    answer_key      JSON NOT NULL,
    eval_type       ENUM('contains', 'sequence') NOT NULL DEFAULT 'contains',
    source          ENUM('seed', 'admin', 'ai') NOT NULL DEFAULT 'seed',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- Réponses individuelles
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answers (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    session_id          VARCHAR(36) NOT NULL,
    child_id            INT NOT NULL,
    question_id         INT NOT NULL,
    domain              ENUM('Memory', 'Logic & Reasoning', 'Attention & Focus') NOT NULL,
    difficulty          ENUM('easy', 'medium', 'hard') NOT NULL,
    age                 TINYINT NOT NULL,
    raw_answer          TEXT,
    answer_correct      TINYINT NOT NULL DEFAULT 0,
    partial_score       FLOAT NOT NULL DEFAULT 0.0,
    response_time_sec   FLOAT NOT NULL DEFAULT 0.0,
    attempts            TINYINT NOT NULL DEFAULT 1,
    predicted_score     FLOAT DEFAULT NULL,
    cognitive_score     FLOAT DEFAULT NULL,
    answered_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question_bank(id)
);

-- ----------------------------------------------------------------
-- Scores agrégés par domaine
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_scores (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    session_id      VARCHAR(36) NOT NULL,
    domain          ENUM('Memory', 'Logic & Reasoning', 'Attention & Focus') NOT NULL,
    average_score   FLOAT NOT NULL,
    level           VARCHAR(20) NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- ================================================================
-- Seed data
-- ================================================================

-- Compte admin par défaut (mot de passe bcrypt = "admin123")
-- À CHANGER en production via la page profil ou directement en BDD.
INSERT INTO users (name, age, username, password, role) VALUES
('Administrateur', NULL, 'admin',
 '$2b$12$QL6OycLCI7m6eZUMXHjYl.db5GP2UWZ7G.45qr7kh0MO/jUIciva.',
 'admin');

-- Banque de questions par défaut
INSERT INTO question_bank (domain, difficulty, question_text, answer_key, eval_type, source) VALUES
-- Memory
('Memory', 'easy', 'I will say 3 words: apple, car, moon. Can you repeat them?', '["apple","car","moon"]', 'sequence', 'seed'),
('Memory', 'easy', 'What are the first 3 letters of the alphabet?', '["a","b","c"]', 'sequence', 'seed'),
('Memory', 'easy', 'Name the 3 primary colors.', '["red","blue","yellow"]', 'contains', 'seed'),
('Memory', 'medium', 'I will say 5 words: river, lamp, tiger, clock, bread. Repeat them in order.', '["river","lamp","tiger","clock","bread"]', 'sequence', 'seed'),
('Memory', 'medium', 'Remember this number: 7 4 2 9. Tell it back.', '["7","4","2","9"]', 'sequence', 'seed'),
('Memory', 'medium', 'A boy went to the store and bought milk, eggs, and cheese. What did he buy?', '["milk","eggs","cheese"]', 'contains', 'seed'),
('Memory', 'hard', 'Repeat exactly: The blue bicycle was parked next to the tall red gate.', '["blue bicycle","parked","tall red gate"]', 'contains', 'seed'),
('Memory', 'hard', 'Name the months of the year in reverse order starting from December.', '["december","november","october","september","august","july","june","may","april","march","february","january"]', 'sequence', 'seed'),
('Memory', 'hard', 'I will say 7 numbers: 3 8 1 6 4 9 2. Repeat them backwards.', '["2","9","4","6","1","8","3"]', 'sequence', 'seed'),

-- Logic & Reasoning
('Logic & Reasoning', 'easy', 'Which is bigger: an elephant or a cat?', '["elephant"]', 'contains', 'seed'),
('Logic & Reasoning', 'easy', 'If you have 3 apples and eat 1, how many are left?', '["2","two"]', 'contains', 'seed'),
('Logic & Reasoning', 'easy', 'What comes next: circle, square, circle, square, ___?', '["circle"]', 'contains', 'seed'),
('Logic & Reasoning', 'medium', 'What number comes next: 2, 4, 6, 8, ___?', '["10","ten"]', 'contains', 'seed'),
('Logic & Reasoning', 'medium', 'A train leaves at 9:00 and the trip takes 2 hours. When does it arrive?', '["11","11:00"]', 'contains', 'seed'),
('Logic & Reasoning', 'medium', 'All dogs are animals. Rex is a dog. Is Rex an animal?', '["yes"]', 'contains', 'seed'),
('Logic & Reasoning', 'hard', 'What comes next in the pattern: AZ, BY, CX, ___?', '["dw"]', 'contains', 'seed'),
('Logic & Reasoning', 'hard', 'Tom is taller than Sam. Sam is taller than Ben. Who is the shortest?', '["ben"]', 'contains', 'seed'),
('Logic & Reasoning', 'hard', 'If 5 cats catch 5 mice in 5 minutes, how many cats catch 10 mice in 10 minutes?', '["5","five"]', 'contains', 'seed'),

-- Attention & Focus
('Attention & Focus', 'easy', 'How many legs does a spider have?', '["8","eight"]', 'contains', 'seed'),
('Attention & Focus', 'easy', 'Count the vowels in the word ELEPHANT.', '["3","three"]', 'contains', 'seed'),
('Attention & Focus', 'easy', 'What color is the sky on a clear day?', '["blue"]', 'contains', 'seed'),
('Attention & Focus', 'medium', 'How many times does the letter e appear in: The elephant entered the empty cave?', '["6","six"]', 'contains', 'seed'),
('Attention & Focus', 'medium', 'I will read a list. Say yes only when you hear a fruit: car, apple, bus, banana, door, mango. Which were fruits?', '["apple","banana","mango"]', 'contains', 'seed'),
('Attention & Focus', 'medium', 'What is 4 + 5 + 3 - 2?', '["10","ten"]', 'contains', 'seed'),
('Attention & Focus', 'hard', 'Count backwards from 20 skipping every multiple of 3.', '["20","19","18","17","16","14","13","11","10","8","7","5","4","2","1"]', 'contains', 'seed'),
('Attention & Focus', 'hard', 'Find the mistake: Paris is the capital of Spain and the Eiffel Tower is there.', '["spain","france","not spain"]', 'contains', 'seed'),
('Attention & Focus', 'hard', 'A red ball is in a box. The box is on a blue table. The table is near a window. Where is the ball?', '["box","inside","in the box"]', 'contains', 'seed');
