import type { EquipmentItem } from './index';

export interface AuthUser {
  id: string;
  username: string;
  createdAt?: string;
}

export interface PlayerProfileData {
  id: string;
  level: number;
  coins: number;
  raids_played: number;
  raids_won: number;
  monsters_killed: number;
  bosses_killed: number;
  stats?: Record<string, any>;
}

export interface PlayerInventoryData {
  player_id: string;
  equipped: Record<string, EquipmentItem>;
  stash: EquipmentItem[];
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  profile?: PlayerProfileData;
  inventory?: PlayerInventoryData;
  quests?: Record<string, { current: number; claimed: boolean }>;
  error?: string;
  message?: string;
}

export interface LadderEntry {
  rank: number;
  userId: string;
  username: string;
  maxGearScore: number;
  level: number;
  raidsWon: number;
  monstersKilled: number;
  bossesKilled: number;
  updatedAt?: string;
}

export interface LadderResponse {
  success: boolean;
  ladder: LadderEntry[];
  offline?: boolean;
  message?: string;
  error?: string;
}

export interface SyncPlayerDataPayload {
  coins?: number;
  stats?: Record<string, any>;
  equipped?: Record<string, EquipmentItem>;
  stash?: EquipmentItem[];
  quests?: Record<string, { current: number; claimed: boolean }>;
  raidOutcome?: 'extracted' | 'died' | 'abandoned';
  monstersKilled?: number;
  bossesKilled?: number;
  gearScore?: number;
}
