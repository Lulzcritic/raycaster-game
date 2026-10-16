import type { EnemyTypeDefinition } from '../types/enemy';

export const ENEMY_TYPES: Record<string, EnemyTypeDefinition> = {
  blob: {
    id: 'blob',
    name: 'Blob de Fange Toxique',
    rank: 'normal',
    attackType: 'melee',
    movementPattern: 'hop',
    stats: {
      maxHealth: 30,
      damage: 8,
      defense: 1,
      moveSpeed: 0.9,
      aggroRadius: 5.5,
      attackRange: 0.65,
      attackCooldown: 1.1,
      attackWindup: 0.2,
    },
    scale: 0.38,
    hitBox: 0.28,
    colorTheme: {
      primary: '#44cc33',
      secondary: '#248818',
      outline: '#0c2e0a',
      eyeColor: '#ffdd33',
      glowColor: 'rgba(68, 204, 51, 0.4)',
    },
    description: 'Une masse de vase nécromantique visqueuse qui bondit lourdement vers tout ce qui respire.',
    dropTable: [
      { itemId: 'boots_squeaky_abyss_poulaines', chance: 0.35 },
      { itemId: 'hat_leech_infested_mitre', chance: 0.2 },
    ],
  },

  blob_elite: {
    id: 'blob_elite',
    name: 'Blob Abyssal Sinistre',
    rank: 'elite',
    attackType: 'melee',
    movementPattern: 'hop',
    stats: {
      maxHealth: 75,
      damage: 16,
      defense: 3,
      moveSpeed: 1.15,
      aggroRadius: 7.0,
      attackRange: 0.75,
      attackCooldown: 0.95,
      attackWindup: 0.18,
    },
    scale: 0.52,
    hitBox: 0.38,
    colorTheme: {
      primary: '#9933ee',
      secondary: '#6611bb',
      outline: '#220044',
      eyeColor: '#ff2255',
      glowColor: 'rgba(153, 51, 238, 0.55)',
    },
    description: 'Un spécimen corrompu gorgé de résidus d’âmes errantes. Ses bonds projettent des vapeurs suffocantes.',
    dropTable: [
      { itemId: 'hat_myopic_necromancer', chance: 0.6 },
      { itemId: 'boots_slippery_graveyard_clogs', chance: 0.45 },
    ],
  },

  blob_boss: {
    id: 'blob_boss',
    name: 'Goliath Nécrotique de la Crypte',
    rank: 'boss',
    attackType: 'melee',
    movementPattern: 'hop',
    stats: {
      maxHealth: 180,
      damage: 26,
      defense: 5,
      moveSpeed: 1.05,
      aggroRadius: 9.0,
      attackRange: 0.95,
      attackCooldown: 1.25,
      attackWindup: 0.3,
    },
    scale: 0.82,
    hitBox: 0.55,
    colorTheme: {
      primary: '#cc2233',
      secondary: '#881122',
      outline: '#330008',
      eyeColor: '#ffdd00',
      glowColor: 'rgba(204, 34, 51, 0.65)',
    },
    description: 'La source ancestrale de la corruption des cryptes. Une masse colossale de chair gélatineuse et de soufre.',
    dropTable: [
      { itemId: 'weapon_crooked_phylactery_dagger', chance: 1.0 },
      { itemId: 'armor_shrunk_black_mass_robe', chance: 0.8 },
    ],
  },
};

export function getEnemyType(id: string): EnemyTypeDefinition {
  const type = ENEMY_TYPES[id];
  if (!type) {
    throw new Error(`Type d'ennemi inconnu : "${id}".`);
  }
  return type;
}
