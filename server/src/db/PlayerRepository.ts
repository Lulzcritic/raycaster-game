import { Database } from './Database';
import type {
  DbPlayerInventory,
  DbPlayerProfile,
  EquippedItemsMap,
  SavePlayerDataPayload,
} from './types';
import type { EquipmentItem } from '../../../src/types';

/**
 * Répertoire d'accès aux données joueur dans PostgreSQL :
 * - Profil joueur (niveau, pièces d'or, statistiques de raid)
 * - Inventaire équipé et coffre/stash de réserve du campement
 * - Journal de quêtes
 * - Historique des expéditions
 */
export class PlayerRepository {
  /**
   * Récupère le profil du joueur.
   */
  public static async getProfile(userId: string): Promise<DbPlayerProfile | null> {
    const res = await Database.query<DbPlayerProfile>(
      `SELECT * FROM player_profiles WHERE id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Récupère l'inventaire complet du joueur (objets équipés et objets en réserve).
   */
  public static async getInventory(userId: string): Promise<DbPlayerInventory | null> {
    const res = await Database.query<DbPlayerInventory>(
      `SELECT * FROM player_inventories WHERE player_id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Récupère les données de progression des quêtes du joueur.
   */
  public static async getQuests(userId: string): Promise<Record<string, any>> {
    const res = await Database.query<{ quests: Record<string, any> }>(
      `SELECT quests FROM player_quests WHERE player_id = $1`,
      [userId]
    );
    return res.rows[0]?.quests ?? {};
  }

  /**
   * Récupère d'un coup l'ensemble des données du joueur (profil, inventaire, quêtes).
   */
  public static async getFullPlayerData(userId: string): Promise<{
    profile: DbPlayerProfile;
    inventory: DbPlayerInventory;
    quests: Record<string, any>;
  } | null> {
    const profile = await this.getProfile(userId);
    if (!profile) return null;

    const inventory = (await this.getInventory(userId)) ?? {
      player_id: userId,
      equipped: {},
      stash: [],
      updated_at: new Date(),
    };

    const quests = await this.getQuests(userId);

    return { profile, inventory, quests };
  }

  /**
   * Sauvegarde et synchronise l'ensemble des données du joueur de manière transactionnelle :
   * - Pièces d'or et statistiques
   * - Inventaire équipé et coffre
   * - Quêtes
   * - Mise à jour automatique des victoires/défaites de raid
   */
  public static async savePlayerData(
    userId: string,
    payload: SavePlayerDataPayload
  ): Promise<{ profile: DbPlayerProfile; inventory: DbPlayerInventory; quests: Record<string, any> }> {
    const client = await Database.getClient();

    try {
      await client.query('BEGIN');

      // 1. Mise à jour du profil joueur
      const profileUpdates: string[] = ['updated_at = NOW()'];
      const profileParams: any[] = [userId];
      let pIdx = 2;

      if (payload.coins !== undefined) {
        profileUpdates.push(`coins = $${pIdx++}`);
        profileParams.push(Math.max(0, Math.floor(payload.coins)));
      }

      if (payload.stats !== undefined) {
        profileUpdates.push(`stats = $${pIdx++}::jsonb`);
        profileParams.push(JSON.stringify(payload.stats));
      }

      if (payload.monstersKilled !== undefined && payload.monstersKilled > 0) {
        profileUpdates.push(`monsters_killed = monsters_killed + $${pIdx++}`);
        profileParams.push(payload.monstersKilled);
      }

      if (payload.bossesKilled !== undefined && payload.bossesKilled > 0) {
        profileUpdates.push(`bosses_killed = bosses_killed + $${pIdx++}`);
        profileParams.push(payload.bossesKilled);
      }

      if (payload.raidOutcome) {
        profileUpdates.push(`raids_played = raids_played + 1`);
        if (payload.raidOutcome === 'extracted') {
          profileUpdates.push(`raids_won = raids_won + 1`);
        }
      }

      const profileSql = `
        UPDATE player_profiles
        SET ${profileUpdates.join(', ')}
        WHERE id = $1
        RETURNING *
      `;
      const profileRes = await client.query<DbPlayerProfile>(profileSql, profileParams);
      const updatedProfile = profileRes.rows[0];

      // 2. Mise à jour de l'inventaire (équipé et coffre)
      const invUpdates: string[] = ['updated_at = NOW()'];
      const invParams: any[] = [userId];
      let iIdx = 2;

      if (payload.equipped !== undefined) {
        invUpdates.push(`equipped = $${iIdx++}::jsonb`);
        invParams.push(JSON.stringify(payload.equipped));
      }

      if (payload.stash !== undefined) {
        invUpdates.push(`stash = $${iIdx++}::jsonb`);
        invParams.push(JSON.stringify(payload.stash));
      }

      const invSql = `
        INSERT INTO player_inventories (player_id, equipped, stash, updated_at)
        VALUES ($1, COALESCE($2::jsonb, '{}'::jsonb), COALESCE($3::jsonb, '[]'::jsonb), NOW())
        ON CONFLICT (player_id) DO UPDATE
        SET ${invUpdates.join(', ')}
        RETURNING *
      `;
      const invRes = await client.query<DbPlayerInventory>(
        invSql,
        invParams.length > 1
          ? invParams
          : [userId, JSON.stringify(payload.equipped ?? {}), JSON.stringify(payload.stash ?? [])]
      );
      const updatedInventory = invRes.rows[0];

      // 3. Mise à jour des quêtes si fournies
      let updatedQuests: Record<string, any> = {};
      if (payload.quests !== undefined) {
        const questRes = await client.query<{ quests: Record<string, any> }>(
          `INSERT INTO player_quests (player_id, quests, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (player_id) DO UPDATE
           SET quests = $2::jsonb, updated_at = NOW()
           RETURNING quests`,
          [userId, JSON.stringify(payload.quests)]
        );
        updatedQuests = questRes.rows[0]?.quests ?? payload.quests;
      } else {
        const questRes = await client.query<{ quests: Record<string, any> }>(
          `SELECT quests FROM player_quests WHERE player_id = $1`,
          [userId]
        );
        updatedQuests = questRes.rows[0]?.quests ?? {};
      }

      // 4. Enregistrement optionnel dans l'historique des expéditions
      if (payload.raidOutcome) {
        await client.query(
          `INSERT INTO raid_history (player_id, outcome, coins_collected, gear_score, monsters_slain)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            payload.raidOutcome,
            payload.coins ?? 0,
            payload.gearScore ?? 0,
            payload.monstersKilled ?? 0,
          ]
        );
      }

      await client.query('COMMIT');

      return {
        profile: updatedProfile,
        inventory: updatedInventory,
        quests: updatedQuests,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Met à jour de façon atomique le montant des pièces d'or du joueur.
   */
  public static async updateCoins(userId: string, newTotal: number): Promise<number> {
    const validTotal = Math.max(0, Math.floor(newTotal));
    const res = await Database.query<{ coins: number }>(
      `UPDATE player_profiles
       SET coins = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING coins`,
      [userId, validTotal]
    );
    return res.rows[0]?.coins ?? 0;
  }
}
