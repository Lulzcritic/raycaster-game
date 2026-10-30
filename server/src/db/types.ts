import type { EquipmentItem, EquipmentSlot } from '../../../src/types';

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: Date;
  last_login_at?: Date | null;
}

export interface PlayerStatsBonus {
  damageBonus?: number;
  defenseBonus?: number;
  speedBonus?: number;
}

export interface DbPlayerProfile {
  id: string;
  username: string;
  level: number;
  experience: number;
  coins: number;
  max_health: number;
  stats: PlayerStatsBonus;
  raids_played: number;
  raids_won: number;
  monsters_killed: number;
  bosses_killed: number;
  created_at: Date;
  updated_at: Date;
}

export type EquippedItemsMap = Partial<Record<EquipmentSlot, EquipmentItem>>;

export interface DbPlayerInventory {
  player_id: string;
  equipped: EquippedItemsMap;
  stash: EquipmentItem[];
  updated_at: Date;
}

export interface DbPlayerQuests {
  player_id: string;
  quests: Record<string, any>;
  updated_at: Date;
}

export interface AuthSession {
  token: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  createdAt: Date;
  lastLoginAt?: Date | null;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
  profile: DbPlayerProfile;
  inventory: DbPlayerInventory;
  quests: Record<string, any>;
}

export interface SavePlayerDataPayload {
  coins?: number;
  equipped?: EquippedItemsMap;
  stash?: EquipmentItem[];
  quests?: Record<string, any>;
  stats?: PlayerStatsBonus;
  raidOutcome?: 'extracted' | 'died' | 'abandoned';
  monstersKilled?: number;
  bossesKilled?: number;
  gearScore?: number;
}
