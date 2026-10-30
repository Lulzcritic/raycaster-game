import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Gestionnaire centralisé du pool de connexions PostgreSQL pour The Old Citadel.
 * Gère automatiquement :
 * - La résolution de l'URL de connexion depuis l'environnement (DATABASE_URL ou variables PG*)
 * - L'auto-initialisation du schéma DDL si nécessaire
 * - La tolérance aux pannes : ne bloque pas le démarrage du serveur de jeu si PostgreSQL est encore éteint
 */
export class Database {
  private static pool: Pool | null = null;
  private static isOnline = false;
  private static connectionPromise: Promise<boolean> | null = null;

  public static getConnectionString(): string {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }

    const host = process.env.PGHOST || 'localhost';
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER || 'raycaster';
    const password = process.env.PGPASSWORD || 'raycaster_secret';
    const database = process.env.PGDATABASE || 'raycaster_db';

    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  /**
   * Initialise le pool de connexion et tente une première connexion à PostgreSQL.
   */
  public static async init(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      const connectionString = this.getConnectionString();
      try {
        this.pool = new Pool({
          connectionString,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 4000,
        });

        this.pool.on('error', (err) => {
          console.warn('[Database] Erreur inattendue sur client idle PostgreSQL :', err.message);
        });

        // Test de connexion ping
        const client = await this.pool.connect();
        try {
          await client.query('SELECT 1');
          this.isOnline = true;
          console.log(`[Database] ✅ Connecté avec succès à PostgreSQL (${connectionString.split('@')[1] || 'DB'})`);
        } finally {
          client.release();
        }

        // Création automatique des tables si pas encore créées
        await this.initSchema();
        return true;
      } catch (err: any) {
        this.isOnline = false;
        console.warn(
          `[Database] ⚠️ PostgreSQL non joignable (${err.message}). ` +
          `Assurez-vous que le conteneur Docker est démarré ('docker compose up -d postgres'). ` +
          `Le serveur de jeu continue de fonctionner en mode mémoire.`
        );
        return false;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Exécute les migrations DDL pour s'assurer que toutes les tables sont créées.
   */
  public static async initSchema(): Promise<void> {
    if (!this.isOnline || !this.pool) return;

    const schemaSql = `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

      CREATE TABLE IF NOT EXISTS user_sessions (
          token VARCHAR(128) PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS player_profiles (
          id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          username VARCHAR(50) NOT NULL,
          level INT NOT NULL DEFAULT 1,
          experience INT NOT NULL DEFAULT 0,
          coins INT NOT NULL DEFAULT 100,
          max_health INT NOT NULL DEFAULT 100,
          stats JSONB NOT NULL DEFAULT '{"damageBonus": 0, "defenseBonus": 0, "speedBonus": 0}'::jsonb,
          raids_played INT NOT NULL DEFAULT 0,
          raids_won INT NOT NULL DEFAULT 0,
          monsters_killed INT NOT NULL DEFAULT 0,
          bosses_killed INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_player_profiles_coins ON player_profiles(coins);

      CREATE TABLE IF NOT EXISTS player_inventories (
          player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          equipped JSONB NOT NULL DEFAULT '{}'::jsonb,
          stash JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS player_quests (
          player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          quests JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    try {
      await this.pool.query(schemaSql);
      console.log('[Database] ✅ Tables et index PostgreSQL vérifiés et prêts.');
    } catch (err: any) {
      console.error('[Database] Erreur lors de l initialisation du schéma :', err.message);
    }
  }

  /**
   * Exécute une requête SQL paramétrée.
   */
  public static async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<R>> {
    if (!this.pool || !this.isOnline) {
      throw new Error('La base de données PostgreSQL n\'est pas connectée');
    }
    return this.pool.query<R>(text, params);
  }

  /**
   * Obtient un client dédié du pool pour les transactions atomiques.
   */
  public static async getClient(): Promise<PoolClient> {
    if (!this.pool || !this.isOnline) {
      throw new Error('La base de données PostgreSQL n\'est pas connectée');
    }
    return this.pool.connect();
  }

  public static isConnected(): boolean {
    return this.isOnline;
  }

  public static getStatus(): { online: boolean; totalCount?: number; idleCount?: number; waitingCount?: number } {
    return {
      online: this.isOnline,
      totalCount: this.pool?.totalCount,
      idleCount: this.pool?.idleCount,
      waitingCount: this.pool?.waitingCount,
    };
  }

  public static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isOnline = false;
      this.connectionPromise = null;
    }
  }
}
