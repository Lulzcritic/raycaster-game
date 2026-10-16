import type { PlayerConfig, TextureDefinition } from '../types';

export const SCREEN_CONFIG = {
  WIDTH: 320,
  HEIGHT: 240,
} as const;

export const TEXTURE_CONFIG = {
  DEFAULT_SIZE: 64,
  SKYBOX_WIDTH: SCREEN_CONFIG.WIDTH,
  SKYBOX_HEIGHT: SCREEN_CONFIG.HEIGHT / 2,
  WEAPON_SIZE: 120,
  HORIZONTAL_SHADING: 'rgba(0, 0, 0, 0.35)',
} as const;

/**
 * Identifiants des textures et tuiles utilisables dans les niveaux
 */
export const TILE_TYPE = {
  HAND_WAND: -10,
  SKY_1: -1,
  SKY_2: -2,
  GROUND_1: 0,
  WALL_1: 1,
  GROUND_2: 2,
  CHEST: 3,
  DOOR: 4,
} as const;

/**
 * Catalogue des textures du dossier src/assets/textures/ associées à leur ID et catégorie
 */
export const TEXTURE_DEFINITIONS: readonly TextureDefinition[] = [
  { id: TILE_TYPE.HAND_WAND, category: 'weapon', path: '/assets/textures/handwand.jpg' },
  { id: TILE_TYPE.SKY_1, category: 'sky', path: '/assets/textures/skybox2.jpg' },
  { id: TILE_TYPE.SKY_2, category: 'sky', path: '/assets/textures/skybox.jpg' },
  { id: TILE_TYPE.GROUND_1, category: 'floor', path: '/assets/textures/ground1.jpg' },
  { id: TILE_TYPE.WALL_1, category: 'wall', path: '/assets/textures/wall1.jpg' },
  { id: TILE_TYPE.GROUND_2, category: 'floor', path: '/assets/textures/ground2.jpg' },
  {
    id: TILE_TYPE.CHEST,
    category: 'sprite',
    path: '/assets/textures/chest.png',
    scale: 0.42,
  },
  {
    id: TILE_TYPE.DOOR,
    category: 'wall',
    path: 'procedural:door',
  },
];

export const COLORS = {
  CEILING: '#333',
  FLOOR: '#666',
  WALL_VERTICAL: '#ca1818',
  WALL_HORIZONTAL: '#911111',
} as const;

export const KEYS = {
  MOVE_FORWARD: 'w',
  MOVE_BACKWARD: 's',
  STRAFE_LEFT: 'a',
  STRAFE_RIGHT: 'd',
  TURN_LEFT: 'ArrowLeft',
  TURN_RIGHT: 'ArrowRight',
  SHOOT: ' ',
  INTERACT: 'f',
} as const;

export const INTERACTION_CONFIG = {
  MAX_DISTANCE: 1.4,
  MAX_ANGLE: Math.PI / 3,
} as const;

export const FIREBALL_CONFIG = {
  SPEED: 5.5,
  COOLDOWN: 0.28,
  SPAWN_OFFSET: 0.3,
  MAX_DISTANCE: 20,
  SCALE: 0.26,
  EXPLOSION_SCALE: 0.48,
  EXPLOSION_DURATION: 0.22,
} as const;

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  x: 4,
  y: 3,
  width: 10,
  height: 10,
  angle: 0,
  fov: (75 * Math.PI) / 180, // Champ de vision par défaut à 75° (au lieu de 45° trop zoomé)
  speedRotation: 1,
  speedMove: 1,
  speedStrafe: 0.65,
  mouseSensitivity: 0.0025,
  bobFrequency: 10,
  bobAmplitude: 3.5,
  hitBox: 0.2,
};
