# 🏰 The Old Citadel - Base de Données PostgreSQL & API Joueur

Ce document décrit l'architecture de persistance des joueurs, le conteneur Docker PostgreSQL dédié, et l'API REST mise à disposition pour stocker les inventaires, pièces d'or, statistiques de raid et quêtes.

---

## 🚀 1. Démarrage Rapide avec Docker

Le conteneur PostgreSQL est configuré dans le fichier [`docker-compose.yml`](file:///c:/Users/darkr/Documents/raycaster-game/docker-compose.yml).

### Démarrer uniquement la base de données PostgreSQL :
```bash
docker compose up -d postgres
```

### Vérifier le statut du conteneur :
```bash
docker compose ps
```

### Arrêter le conteneur :
```bash
docker compose stop postgres
```

### Variables d'environnement configurables (`.env`) :
Consultez le fichier [`.env.example`](file:///c:/Users/darkr/Documents/raycaster-game/.env.example) :
```ini
POSTGRES_USER=raycaster
POSTGRES_PASSWORD=raycaster_secret
POSTGRES_DB=raycaster_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://raycaster:raycaster_secret@localhost:5432/raycaster_db
```

> **Note de résilience** : Si le conteneur PostgreSQL n'est pas démarré, le serveur de jeu démarre quand même normalement sans planter, bascule gracieusement en mode mémoire / hors-ligne et affiche un avertissement clair dans la console.

---

## 🗄️ 2. Schéma de la Base de Données

Le script d'initialisation automatique est situé dans [`docker/postgres/init.sql`](file:///c:/Users/darkr/Documents/raycaster-game/docker/postgres/init.sql) et s'exécute également au démarrage via [`server/src/db/Database.ts`](file:///c:/Users/darkr/Documents/raycaster-game/server/src/db/Database.ts).

### Tables principales :

1. **`users`** :
   - `id` (UUID, clé primaire)
   - `username` (VARCHAR 50, unique insensible à la casse via index)
   - `password_hash` (VARCHAR 255, hachage Scrypt 64 octets)
   - `salt` (VARCHAR 64, sel cryptographique unique de 16 octets)
   - `created_at`, `last_login_at` (TIMESTAMPTZ)

2. **`user_sessions`** :
   - `token` (VARCHAR 128, clé primaire, jeton aléatoire de 32 octets hex)
   - `user_id` (UUID, clé étrangère vers `users.id` avec `ON DELETE CASCADE`)
   - `created_at`, `expires_at` (TIMESTAMPTZ, sessions valides 30 jours par défaut)

3. **`player_profiles`** :
   - `id` (UUID, clé primaire reliée à `users.id`)
   - `level` (INT, défaut 1)
   - `coins` (INT, solde de pièces d'or, défaut 100)
   - `raids_played`, `raids_won`, `monsters_killed`, `bosses_killed` (INT)
   - `stats` (JSONB, statistiques de vie, mana, vitesse, etc.)

4. **`player_inventories`** :
   - `player_id` (UUID, clé primaire reliée à `users.id`)
   - `equipped` (JSONB : `{ helmet, armor, boots, weapon, offhand, ring, amulet }`)
   - `stash` (JSONB : tableau d'objets `EquipmentItem[]` du coffre de réserve au campement)

5. **`player_quests`** :
   - `player_id` (UUID, clé primaire reliée à `users.id`)
   - `quests` (JSONB : progression des objectifs et récompenses)

6. **`raid_history`** :
   - `id` (UUID, clé primaire)
   - `player_id` (UUID)
   - `outcome` ('extracted' | 'died' | 'abandoned')
   - `coins_collected`, `gear_score`, `monsters_slain` (INT)
   - `created_at` (TIMESTAMPTZ)

---

## 📡 3. Endpoints REST API (Serveur HTTP / Passerelle)

Tous les endpoints gèrent automatiquement les requêtes prévol CORS (`OPTIONS`) et les en-têtes JSON.

### 🛡️ Santé de la Base de Données
- **`GET /api/db/health`**
  - Réponse :
    ```json
    { "online": true, "totalCount": 1, "idleCount": 1, "waitingCount": 0 }
    ```

---

### 👤 Inscription d'un nouveau compte
- **`POST /api/auth/register`**
  - **Corps JSON** :
    ```json
    {
      "username": "MonAventurier",
      "password": "MonSuperMotDePasse123"
    }
    ```
  - **Réponse HTTP 201** :
    ```json
    {
      "success": true,
      "token": "4a7bc9... (64 hex)",
      "user": {
        "id": "b3e045f2-...",
        "username": "MonAventurier",
        "createdAt": "2026-10-30T16:00:00.000Z"
      },
      "profile": {
        "id": "b3e045f2-...",
        "level": 1,
        "coins": 100,
        "raids_played": 0,
        "raids_won": 0,
        "monsters_killed": 0,
        "bosses_killed": 0,
        "stats": {}
      },
      "inventory": {
        "player_id": "b3e045f2-...",
        "equipped": {},
        "stash": []
      },
      "quests": {}
    }
    ```

---

### 🔑 Connexion
- **`POST /api/auth/login`**
  - **Corps JSON** :
    ```json
    {
      "username": "MonAventurier",
      "password": "MonSuperMotDePasse123"
    }
    ```
  - **Réponse HTTP 200** :
    Identique à la réponse d'inscription, avec le jeton de session renouvelé.

---

### 🚪 Déconnexion
- **`POST /api/auth/logout`**
  - **En-tête requis** : `Authorization: Bearer <token>`
  - Réponse HTTP 200 : `{ "success": true, "message": "Déconnexion réussie" }`

---

### 🔍 Vérification de session active (`me`)
- **`GET /api/auth/me`**
  - **En-tête requis** : `Authorization: Bearer <token>`
  - Réponse HTTP 200 : Profil joueur et métadonnées du compte.

---

### 📦 Récupération complète des données joueur
- **`GET /api/player/data`**
  - **En-tête requis** : `Authorization: Bearer <token>`
  - Réponse HTTP 200 :
    ```json
    {
      "success": true,
      "user": { "id": "...", "username": "MonAventurier" },
      "data": {
        "profile": { "coins": 250, ... },
        "inventory": { "equipped": { ... }, "stash": [ ... ] },
        "quests": { ... }
      }
    }
    ```

---

### 💾 Synchronisation et Sauvegarde joueur
- **`POST /api/player/sync`**
  - **En-tête requis** : `Authorization: Bearer <token>`
  - **Corps JSON (tous les champs sont optionnels pour mise à jour partielle ou totale)** :
    ```json
    {
      "coins": 450,
      "equipped": {
        "weapon": { "id": "wpn_epic_sword", "name": "Épée spectrale", "gearScore": 140 },
        "armor": { "id": "arm_mithril", "name": "Cotte de mailles", "gearScore": 95 }
      },
      "stash": [
        { "id": "pot_heal_large", "name": "Élixir supérieur", "gearScore": 20 }
      ],
      "quests": {
        "boss_carrot_king": { "completed": true, "claimed": false }
      },
      "raidOutcome": "extracted",
      "monstersKilled": 12,
      "bossesKilled": 1,
      "gearScore": 235
    }
    ```
  - **Réponse HTTP 200** :
    ```json
    {
      "success": true,
      "user": { "id": "...", "username": "MonAventurier" },
      "profile": { ... },
      "inventory": { ... },
      "quests": { ... }
    }
    ```

---

## 💻 4. Exemples d'intégration Frontend (JavaScript / Fetch)

### Inscription d'un joueur :
```javascript
async function registerPlayer(username, password) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('raycaster_auth_token', data.token);
    console.log('Connecté en tant que :', data.user.username);
  }
  return data;
}
```

### Connexion :
```javascript
async function loginPlayer(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('raycaster_auth_token', data.token);
  }
  return data;
}
```

### Sauvegarde après un raid ou achat en boutique :
```javascript
async function syncPlayerData(savePayload) {
  const token = localStorage.getItem('raycaster_auth_token');
  if (!token) return;

  const response = await fetch('/api/player/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(savePayload)
  });
  return await response.json();
}
```
