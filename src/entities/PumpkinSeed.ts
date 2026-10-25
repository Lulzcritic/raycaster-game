import { getEnemyType } from '../config/enemyTypes';
import { Enemy } from './Enemy';
import type { Entity } from './Entity';
import type { Player } from './Player';

/**
 * Graine de Citrouille magique pondue sur le sol.
 * Possède sa propre barre de vie overhead.
 * Si le joueur ne la détruit pas avant l'échéance de son compte à rebours,
 * elle éclot et engendre une nouvelle Citrouille Ensorcelée.
 */
export class PumpkinSeed extends Enemy {
  constructor(
    x: number,
    y: number,
    player: Player,
    onSpawnEntity?: (entity: Entity) => void,
    onNotify?: (message: string) => void
  ) {
    super(
      x,
      y,
      getEnemyType('pumpkin_seed'),
      player,
      onSpawnEntity,
      onNotify
    );
  }
}
