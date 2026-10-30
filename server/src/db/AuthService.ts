import crypto from 'crypto';
import { Database } from './Database';
import type { AuthResult, DbPlayerInventory, DbPlayerProfile, DbUser, PublicUser } from './types';

/**
 * Service de gestion de la sécurité, du hachage de mot de passe et des sessions joueurs.
 * Utilise l'algorithme Scrypt (recommandé par l'OWASP, résistant aux attaques par GPU/ASIC)
 * sans dépendance externe binaire compilée.
 */
export class AuthService {
  /**
   * Valide le format du nom d'utilisateur (3 à 30 caractères alphanumériques ou underscore).
   */
  public static validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Le nom d utilisateur est requis' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      return { valid: false, error: 'Le nom d utilisateur doit comporter entre 3 et 30 caractères' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Le nom d utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores',
      };
    }
    return { valid: true };
  }

  /**
   * Valide la solidité du mot de passe (au moins 6 caractères).
   */
  public static validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Le mot de passe est requis' };
    }
    if (password.length < 6) {
      return { valid: false, error: 'Le mot de passe doit comporter au moins 6 caractères' };
    }
    return { valid: true };
  }

  /**
   * Génère un sel cryptographique aléatoire de 16 octets (32 caractères hexadécimaux).
   */
  public static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hache un mot de passe avec un sel unique via Scrypt (64 octets).
   */
  public static hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  /**
   * Compare de façon sécurisée (temps constant) le mot de passe fourni avec le haché enregistré.
   */
  public static verifyPassword(password: string, salt: string, storedHash: string): boolean {
    const computedHash = this.hashPassword(password, salt);
    try {
      return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Génère un jeton de session cryptographique aléatoire de 32 octets (64 caractères).
   */
  public static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Enregistre un nouveau joueur dans PostgreSQL :
   * 1. Crée l'utilisateur dans 'users'
   * 2. Crée son profil initial dans 'player_profiles' (100 pièces d'or)
   * 3. Crée son inventaire initial dans 'player_inventories'
   * 4. Crée son journal de quêtes dans 'player_quests'
   * 5. Génère et persiste un jeton de session
   */
  public static async register(username: string, password: string): Promise<AuthResult> {
    const userVal = this.validateUsername(username);
    if (!userVal.valid) {
      throw new Error(userVal.error);
    }
    const passVal = this.validatePassword(password);
    if (!passVal.valid) {
      throw new Error(passVal.error);
    }

    const cleanUsername = username.trim();
    const client = await Database.getClient();

    try {
      await client.query('BEGIN');

      // 1. Vérification si le pseudo existe déjà (insensible à la casse)
      const existing = await client.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [
        cleanUsername,
      ]);
      if (existing.rows.length > 0) {
        throw new Error('Ce nom d utilisateur est déjà utilisé');
      }

      // 2. Hachage du mot de passe
      const salt = this.generateSalt();
      const passwordHash = this.hashPassword(password, salt);

      // 3. Insertion utilisateur
      const userRes = await client.query<DbUser>(
        `INSERT INTO users (username, password_hash, salt, last_login_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, username, created_at, last_login_at`,
        [cleanUsername, passwordHash, salt]
      );
      const user = userRes.rows[0];

      // 4. Création profil joueur avec 100 pièces d'or
      const profileRes = await client.query<DbPlayerProfile>(
        `INSERT INTO player_profiles (id, username, coins, level, max_health)
         VALUES ($1, $2, 100, 1, 100)
         RETURNING *`,
        [user.id, user.username]
      );
      const profile = profileRes.rows[0];

      // 5. Création inventaire initial vide
      const invRes = await client.query<DbPlayerInventory>(
        `INSERT INTO player_inventories (player_id, equipped, stash)
         VALUES ($1, '{}'::jsonb, '[]'::jsonb)
         RETURNING *`,
        [user.id]
      );
      const inventory = invRes.rows[0];

      // 6. Création journal de quêtes
      await client.query(
        `INSERT INTO player_quests (player_id, quests)
         VALUES ($1, '{}'::jsonb)`,
        [user.id]
      );

      // 7. Génération de session
      const token = this.generateSessionToken();
      await client.query(
        `INSERT INTO user_sessions (token, user_id)
         VALUES ($1, $2)`,
        [token, user.id]
      );

      await client.query('COMMIT');

      const publicUser: PublicUser = {
        id: user.id,
        username: user.username,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      };

      return {
        token,
        user: publicUser,
        profile,
        inventory,
        quests: {},
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Connecte un joueur existant et génère un jeton de session.
   */
  public static async login(username: string, password: string): Promise<AuthResult> {
    if (!username || !password) {
      throw new Error('Identifiant et mot de passe requis');
    }

    const cleanUsername = username.trim();
    const userRes = await Database.query<DbUser>(
      `SELECT id, username, password_hash, salt, created_at, last_login_at
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [cleanUsername]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Identifiant ou mot de passe incorrect');
    }

    const user = userRes.rows[0];
    const isMatch = this.verifyPassword(password, user.salt, user.password_hash);
    if (!isMatch) {
      throw new Error('Identifiant ou mot de passe incorrect');
    }

    // Mise à jour de la date de dernière connexion
    await Database.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    // Génération et enregistrement de session
    const token = this.generateSessionToken();
    await Database.query(
      `INSERT INTO user_sessions (token, user_id)
       VALUES ($1, $2)`,
      [token, user.id]
    );

    // Récupération des données du profil, inventaire et quêtes
    const profileRes = await Database.query<DbPlayerProfile>(
      `SELECT * FROM player_profiles WHERE id = $1`,
      [user.id]
    );
    const invRes = await Database.query<DbPlayerInventory>(
      `SELECT * FROM player_inventories WHERE player_id = $1`,
      [user.id]
    );
    const questRes = await Database.query<{ quests: Record<string, any> }>(
      `SELECT quests FROM player_quests WHERE player_id = $1`,
      [user.id]
    );

    const publicUser: PublicUser = {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      lastLoginAt: new Date(),
    };

    return {
      token,
      user: publicUser,
      profile: profileRes.rows[0],
      inventory: invRes.rows[0],
      quests: questRes.rows[0]?.quests ?? {},
    };
  }

  /**
   * Vérifie un jeton de session HTTP (Bearer token) et renvoie les infos de l'utilisateur.
   */
  public static async verifySession(token: string): Promise<PublicUser | null> {
    if (!token || typeof token !== 'string') return null;

    try {
      const res = await Database.query<{
        id: string;
        username: string;
        created_at: Date;
        last_login_at: Date | null;
      }>(
        `SELECT u.id, u.username, u.created_at, u.last_login_at
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = $1 AND s.expires_at > NOW()`,
        [token]
      );

      if (res.rows.length === 0) {
        return null;
      }

      const row = res.rows[0];
      return {
        id: row.id,
        username: row.username,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      };
    } catch (err) {
      console.error('[AuthService] Erreur lors de la vérification de session :', err);
      return null;
    }
  }

  /**
   * Supprime un jeton de session lors de la déconnexion.
   */
  public static async logout(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      const res = await Database.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }
}
