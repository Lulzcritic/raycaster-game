export interface Vector2D {
  x: number;
  y: number;
}

export type Side = 0 | 1; // 0 = vertical (Est/Ouest), 1 = horizontal (Nord/Sud)

export type TextureSource = HTMLImageElement | HTMLCanvasElement;

export type TileCategory = 'wall' | 'floor' | 'sky' | 'weapon' | 'sprite';

export interface TextureDefinition {
  id: number;
  category: TileCategory;
  path: string;
  scale?: number;
}

export type EquipmentSlot = 'hat' | 'weapon' | 'armor' | 'boots' | 'key' | 'offhand';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'artifact';

export interface RarityDropRate {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  artifact: number;
}

export interface GearScoreDropTier {
  minScore: number;
  maxScore: number;
  label: string;
  rates: RarityDropRate;
}

export interface ItemStats {
  damage?: number;
  defense?: number;
  magicPower?: number;
  maxHealth?: number;
  moveSpeed?: number;
  castSpeed?: number;
  stealth?: number;
  charisma?: number;
}

export interface StatRollRange {
  min: number;
  max: number;
}

export interface EquipmentItem {
  id: string;
  instanceId?: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  stats: ItemStats;
  gearScore?: number;
  statRanges?: Partial<Record<keyof ItemStats, StatRollRange>>;
  effect?: string;
  description: string;
  textureId?: number;
}

export interface SpriteSpawnData {
  x: number;
  y: number;
  textureId: number;
  scale?: number;
  itemId?: string;
  item?: EquipmentItem;
}

export interface RayHit {
  hit: boolean;
  distance: number;
  side: Side;
  mapX: number;
  mapY: number;
  rayAngle: number;
  tileId: number;
  wallX: number; // Position d'impact normalisée [0, 1[ sur la face du mur
  vectorX: number;
  vectorY: number;
}

export interface PlayerConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  fov: number;
  speedRotation: number;
  speedMove: number;
  speedStrafe: number;
  mouseSensitivity: number;
  bobFrequency: number;
  bobAmplitude: number;
  hitBox: number;
}

export * from './enemy';
import type { EnemySpawnData } from './enemy';

export interface DoorSpawnData {
  x: number;
  y: number;
  requiredKeyId: string;
}

export interface ExtractionSpawnData {
  x: number;
  y: number;
  name: string;
  activationDelaySec?: number;
  requiresBoss?: boolean;
}

export interface DifficultyScaling {
  playerGearScore: number;
  hpMultiplier: number;
  damageMultiplier: number;
  goldMultiplier: number;
}

export interface LevelData {
  name: string;
  grid: number[][];
  floorGrid?: number[][];
  skyTileId?: number;
  sprites?: SpriteSpawnData[];
  chestLoots?: Record<string, EquipmentItem[] | string[]>;
  bossChestCoords?: string[];
  enemies?: EnemySpawnData[];
  doors?: DoorSpawnData[];
  extractions?: ExtractionSpawnData[];
  playerSpawns?: Vector2D[];
  playerSpawn: {
    x: number;
    y: number;
    angle: number;
  };
  difficulty?: DifficultyScaling;
}
