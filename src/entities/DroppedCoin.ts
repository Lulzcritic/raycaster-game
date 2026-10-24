import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import type { Player } from './Player';

/**
 * Pièce d'or tombée au sol suite à la défaite d'un monstre.
 * Rebondit avec une trajectoire parabolique à l'apparition,
 * flotte doucement au sol avec une aura dorée, et peut être
 * ramassée automatiquement par proximité ou avec la touche [F].
 */
export class DroppedCoin extends Entity {
  public readonly value: number;
  private readonly startX: number;
  private readonly startY: number;
  private readonly targetX: number;
  private readonly targetY: number;
  private dropProgress = 0;
  private readonly dropDuration = 0.35;
  private isLanded = false;
  private currentElevation = 0;
  private animTimer = 0;
  private readonly coinScale = 0.28;
  private readonly player: Player;
  private readonly onCollect?: (value: number) => void;
  private isCollected = false;

  constructor(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    value = 1,
    player: Player,
    onCollect?: (value: number) => void
  ) {
    super(startX, startY, 0, 0.2);
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.value = value;
    this.player = player;
    this.onCollect = onCollect;
  }

  public override update(deltaTime: number, _map: GameMap): void {
    if (!this.active || this.isCollected) {
      return;
    }

    this.animTimer += deltaTime;

    if (!this.isLanded) {
      this.dropProgress = Math.min(
        1,
        this.dropProgress + deltaTime / this.dropDuration
      );
      const t = this.dropProgress;
      this.x = this.startX + (this.targetX - this.startX) * t;
      this.y = this.startY + (this.targetY - this.startY) * t;
      // Trajectoire parabolique de saut
      this.currentElevation = 4 * 0.42 * t * (1 - t);

      if (t >= 1) {
        this.isLanded = true;
        this.currentElevation = 0;
      }
    } else {
      // Légère oscillation verticale de lévitation au sol
      this.currentElevation = Math.sin(this.animTimer * 4.5) * 0.025;
    }

    // Ramassage automatique par proximité du joueur
    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 0.65) {
      this.collect();
    }
  }

  public collect(): void {
    if (this.isCollected || !this.active) {
      return;
    }
    this.isCollected = true;
    this.active = false;
    this.onCollect?.(this.value);
  }

  public override isInteractable(): boolean {
    return this.active && !this.isCollected;
  }

  public override getInteractionPrompt(): string {
    return `[F] RAMASSER : ${this.value} PIÈCE${this.value > 1 ? 'S' : ''} D'OR`;
  }

  public override interact(): string | null {
    if (!this.active || this.isCollected) {
      return null;
    }
    const val = this.value;
    this.collect();
    return `+${val} PIÈCE${val > 1 ? 'S' : ''} D'OR !`;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return this.currentElevation;
  }

  public override getScale(): number {
    return this.coinScale;
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!this.active || this.isCollected) {
      return null;
    }
    return CoinSpriteManager.getCoinWorldCanvas();
  }

  public hasLanded(): boolean {
    return this.isLanded;
  }
}
