import type { EquipmentItem } from '../types';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import { RARITY_COLORS } from './ItemCardBillboard';
import type { Player } from './Player';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 255;
  const g = parseInt(clean.substring(2, 4), 16) || 255;
  const b = parseInt(clean.substring(4, 6), 16) || 255;
  return [r, g, b];
}

function darkenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}

/**
 * Orbe d'objet tombé au sol dont la couleur reflète sa rareté
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
  private readonly orbCanvas: HTMLCanvasElement;
  private readonly orbScale = 0.22;
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

    const rarityColor = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
    this.orbCanvas = this.createOrbCanvas(rarityColor);
  }

  public update(deltaTime: number, _map: GameMap): void {
    if (!this.isLanded) {
      this.dropProgress = Math.min(1, this.dropProgress + deltaTime / this.dropDuration);
      const t = this.dropProgress;
      this.x = this.startX + (this.targetX - this.startX) * t;
      this.y = this.startY + (this.targetY - this.startY) * t;
      // Trajectoire en cloche (parabole) pour l'effet de saut hors du coffre
      this.currentElevation = 4 * 0.35 * t * (1 - t);

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
    return this.orbCanvas;
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

  /**
   * Crée une sphère pixel-art ombrée et lumineuse de la couleur de rareté
   */
  private createOrbCanvas(rarityColor: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const cx = 12;
    const cy = 12;
    const r = 9;

    // 1. Contour sombre
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0812';
    ctx.fill();

    // 2. Sphère ombrée 3D
    const grad = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, r - 1);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, rarityColor);
    grad.addColorStop(0.85, darkenHex(rarityColor, 0.42));
    grad.addColorStop(1, '#0c0a14');

    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Reflet spéculaire blanc net (pixel-art)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(cx - 5, cy - 5, 2, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(cx - 3, cy - 5, 2, 1);
    ctx.fillRect(cx - 5, cy - 3, 1, 2);

    // 4. Liseré inférieur lumineux
    ctx.strokeStyle = rarityColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    return canvas;
  }
}
