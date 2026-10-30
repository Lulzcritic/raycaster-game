-- =========================================================================
-- SCHÉMA DE BASE DE DONNÉES POSTGRESQL - THE OLD CITADEL (RAYCASTER)
-- Stockage persistant des comptes joueurs, profils, inventaires,
-- coffres de campement, monnaie et quêtes.
-- =========================================================================

-- Activation des extensions pour génération d'UUID et fonctions cryptographiques
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table des utilisateurs (identifiants d'authentification)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Index insensible à la casse sur le nom d'utilisateur pour des connexions rapides
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- 2. Table des sessions actives (jetons d'authentification)
CREATE TABLE IF NOT EXISTS user_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 3. Table des profils joueurs (niveaux, monnaie persistante, statistiques de raid)
CREATE TABLE IF NOT EXISTS player_profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    experience INT NOT NULL DEFAULT 0,
    coins INT NOT NULL DEFAULT 100, -- Pièces d'or de bienvenue au campement
    max_health INT NOT NULL DEFAULT 100,
    stats JSONB NOT NULL DEFAULT '{"damageBonus": 0, "defenseBonus": 0, "speedBonus": 0}'::jsonb,
    raids_played INT NOT NULL DEFAULT 0,
    raids_won INT NOT NULL DEFAULT 0,
    monsters_killed INT NOT NULL DEFAULT 0,
    bosses_killed INT NOT NULL DEFAULT 0,
    max_gear_score INT NOT NULL DEFAULT 0, -- Gear Score maximum historique atteint
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_coins ON player_profiles(coins);
CREATE INDEX IF NOT EXISTS idx_player_profiles_max_gear_score ON player_profiles(max_gear_score DESC);

-- 4. Table des inventaires des joueurs (équipement actif et réserve/coffre du campement)
CREATE TABLE IF NOT EXISTS player_inventories (
    player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Équipement actuellement porté : { hat, weapon, armor, boots, key, offhand }
    equipped JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Objets stockés en réserve dans le coffre du campement (tableau d'EquipmentItem)
    stash JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Table de progression des quêtes
CREATE TABLE IF NOT EXISTS player_quests (
    player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    quests JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Historique optionnel des expéditions (statistiques post-match)
CREATE TABLE IF NOT EXISTS raid_history (
    id SERIAL PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outcome VARCHAR(20) NOT NULL, -- 'extracted' | 'died' | 'abandoned'
    coins_collected INT NOT NULL DEFAULT 0,
    gear_score INT NOT NULL DEFAULT 0,
    monsters_slain INT NOT NULL DEFAULT 0,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raid_history_player ON raid_history(player_id);
