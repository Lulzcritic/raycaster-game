import { getEnemyType } from '../config/enemyTypes';
import { WalletManager } from '../core/WalletManager';
import { PumpkinSpriteManager } from '../graphics/PumpkinSpriteManager';
import type { GameMap } from '../world/GameMap';
import { DroppedCoin } from './DroppedCoin';
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
  public hatchTimer = 5.5;
  public readonly totalHatchTime = 5.5;
  private hasHatched = false;

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

  public override isFloorAnchored(): boolean {
    return true; // Posée fermement sur le sol
  }

  public override getElevation(): number {
    return 0;
  }

  public override getScale(): number {
    return 0.30;
  }

  public override update(deltaTime: number, _map: GameMap): void {
    if (!this.active) {
      return;
    }

    // Gestion de l'état détruit par le joueur
    if (this.state === 'dead') {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.active = false;
      }
      return;
    }

    // Gestion de l'état étourdi / touché
    if (this.state === 'hurt') {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.state = 'idle';
      }
    }

    // Décompte vers l'éclosion
    this.hatchTimer -= deltaTime;

    if (this.hatchTimer <= 0 && !this.hasHatched) {
      this.hatch();
    }
  }

  /**
   * Éclosion de la graine : donne naissance à une nouvelle Citrouille
   */
  private hatch(): void {
    this.hasHatched = true;
    this.active = false;

    if (this.onSpawnEntity) {
      const pumpkinDef = getEnemyType('pumpkin');
      const babyPumpkin = new Enemy(
        this.x,
        this.y,
        pumpkinDef,
        this.player,
        this.onSpawnEntity,
        this.onNotify
      );
      // La nouvelle citrouille est immédiatement agressive envers le joueur
      babyPumpkin.state = 'aggro';
      this.onSpawnEntity(babyPumpkin);
    }

    this.onNotify?.("UNE GRAINE A ÉCLOS ! UNE NOUVELLE CITROUILLE APPARAÎT !");
  }

  /**
   * Destruction de la graine par le joueur
   */
  protected override die(): void {
    if (this.hasHatched) {
      return;
    }

    this.state = 'dead';
    this.stateTimer = 0.35;

    // Récompense modeste pour avoir neutralisé la graine
    if (this.onSpawnEntity) {
      const coin = new DroppedCoin(
        this.x,
        this.y,
        this.x + (Math.random() - 0.5) * 0.2,
        this.y + (Math.random() - 0.5) * 0.2,
        1,
        this.player,
        (gained) => {
          WalletManager.addCoins(gained);
        }
      );
      this.onSpawnEntity(coin);
    }

    this.onNotify?.("GRAINE DE CITROUILLE ÉCRASÉE AVANT ÉCLOSION !");
  }

  public override getSprite(): HTMLCanvasElement | null {
    const progress = 1 - Math.max(0, this.hatchTimer) / this.totalHatchTime;
    return PumpkinSpriteManager.getSeedSprite(
      this.state,
      this.animTimer,
      progress
    );
  }
}
