export type EnemyRank = 'normal' | 'elite' | 'boss';

export type AttackType = 'melee' | 'ranged';

export type MovementPattern = 'hop' | 'chase' | 'patrol' | 'stationary';

export interface EnemyStats {
  maxHealth: number;
  damage: number;
  defense: number;
  moveSpeed: number;
  aggroRadius: number;
  attackRange: number;
  attackCooldown: number;
  attackWindup?: number;
}

export interface EnemyDropEntry {
  itemId: string;
  chance: number; // 0 à 1
}

export interface EnemyTypeDefinition {
  id: string;
  name: string;
  rank: EnemyRank;
  attackType: AttackType;
  movementPattern: MovementPattern;
  stats: EnemyStats;
  scale: number;
  hitBox: number;
  colorTheme: {
    primary: string;
    secondary: string;
    outline: string;
    eyeColor: string;
    glowColor?: string;
  };
  description?: string;
  dropTable?: readonly EnemyDropEntry[];
}

export interface EnemySpawnData {
  typeId: string;
  x: number;
  y: number;
}
