import type { EquipmentItem } from '../types';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import type { Player } from './Player';

/**
 * Objet d'équipement au sol dont le sprite reflète fidèlement l'apparence et la rareté
 */
export class DroppedItemOrb extends Entity {
  public readonly item: EquipmentItem;
  private readonly startX: number;
  private readonly startY: number;
  private readonly targetX: number;
  private readonly targetY: number;
  private dropProgress = 0;
  private readonly dropDuration = 0.38;
  private isLanded = false;
  private currentElevation = 0;
  private readonly orbScale = 0.42;
  private readonly onSpawnEntity?: (entity: Entity) => void;

  constructor(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    item: EquipmentItem,
    onSpawnEntity?: (entity: Entity) => void
  ) {
    super(startX, startY, 0, 0);
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.item = item;
    this.onSpawnEntity = onSpawnEntity;
  }

  public update(deltaTime: number, _map: GameMap): void {
    if (!this.isLanded) {
      this.dropProgress = Math.min(1, this.dropProgress + deltaTime / this.dropDuration);
      const t = this.dropProgress;
      this.x = this.startX + (this.targetX - this.startX) * t;
      this.y = this.startY + (this.targetY - this.startY) * t;
      // Trajectoire en cloche (parabole) pour l'effet de saut hors du coffre
      this.currentElevation = 4 * 0.45 * t * (1 - t);

      if (t >= 1) {
        this.isLanded = true;
        this.currentElevation = 0;
      }
    } else {
      this.currentElevation = 0;
    }
  }

  public override getElevation(): number {
    return this.currentElevation;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getScale(): number {
    return this.orbScale;
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!this.active) {
      return null;
    }
    return ItemSpriteManager.getItemWorldCanvas(this.item);
  }

  public hasLanded(): boolean {
    return this.isLanded;
  }

  public override isInteractable(): boolean {
    return this.active && this.isLanded;
  }

  public override getInteractionPrompt(player?: Player): string | null {
    if (!this.isInteractable()) {
      return null;
    }

    const willReplace = player ? player.inventory.hasItem(this.item.slot) : false;
    return willReplace
      ? `[F] REMPLACER PAR : ${this.item.name.toUpperCase()}`
      : `[F] PRENDRE : ${this.item.name.toUpperCase()}`;
  }

  public override interact(player: Player, map?: GameMap): string | null {
    if (!this.isInteractable()) {
      return null;
    }

    const replaced = player.pickupItem(this.item);
    this.active = false;

    if (replaced) {
      if (this.onSpawnEntity) {
        let dropTargetX = this.x;
        let dropTargetY = this.y;

        // Si le joueur est presque sur l'orbe (< 0.45), on propulse l'ancien objet légèrement devant lui
        const distToPlayer = Math.hypot(player.x - dropTargetX, player.y - dropTargetY);
        if (distToPlayer < 0.45) {
          const tossDist = 0.65;
          const candidateX = player.x + Math.cos(player.angle) * tossDist;
          const candidateY = player.y + Math.sin(player.angle) * tossDist;
          if (
            map &&
            map.isWalkable(candidateX, candidateY) &&
            map.isWalkable(candidateX + 0.15, candidateY) &&
            map.isWalkable(candidateX - 0.15, candidateY) &&
            map.isWalkable(candidateX, candidateY + 0.15) &&
            map.isWalkable(candidateX, candidateY - 0.15)
          ) {
            dropTargetX = candidateX;
            dropTargetY = candidateY;
          }
        }

        const replacementOrb = new DroppedItemOrb(
          player.x,
          player.y,
          dropTargetX,
          dropTargetY,
          replaced,
          this.onSpawnEntity
        );
        this.onSpawnEntity(replacementOrb);
      }

      return `REMPLACÉ : ${this.item.name.toUpperCase()} (ANCIEN AU SOL)`;
    }

    return `OBTENU : ${this.item.name.toUpperCase()}`;
  }
}
