import type { TextureManager } from '../graphics/TextureManager';
import type { EquipmentItem, ItemRarity, ItemStats } from '../types';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#ffffff',    // Commun : Blanc
  uncommon: '#2ecc71',  // Non commun : Vert
  rare: '#3b9eff',      // Rare : Bleu
  epic: '#b048f8',      // Épique : Violet
  legendary: '#ff8800', // Légendaire : Orange
  artifact: '#ffe600',  // Artéfact : Jaune
};

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'COMMUN',
  uncommon: 'NON COMMUN',
  rare: 'RARE',
  epic: 'EPIQUE',
  legendary: 'LEGENDAIRE',
  artifact: 'ARTEFACT',
};

const STAT_LABELS: Array<{
  key: keyof ItemStats;
  label: string;
  isMultiplier?: boolean;
}> = [
  { key: 'damage', label: 'DÉGÂTS' },
  { key: 'magicPower', label: 'PUISS. MAGIQUE' },
  { key: 'defense', label: 'DÉFENSE' },
  { key: 'maxHealth', label: 'SANTÉ MAX' },
  { key: 'moveSpeed', label: 'VIT. DÉPLACEMENT', isMultiplier: true },
  { key: 'castSpeed', label: 'VIT. INCANTATION', isMultiplier: true },
  { key: 'stealth', label: 'DISCRÉTION' },
  { key: 'charisma', label: 'CHARISME' },
];

/**
 * Entité Billboard affichant la fiche de caractéristiques de l'objet flottant au-dessus d'un orbe d'objet
 */
export class ItemCardBillboard extends Entity {
  private readonly parentEntity: Entity;
  private readonly item: EquipmentItem;
  private readonly textureManager: TextureManager;
  private readonly scale = 0.52;
  private readonly elevationOffset: number;
  private floatTimer = 0;
  private cardCanvas: HTMLCanvasElement | null = null;

  constructor(
    parentEntity: Entity,
    item: EquipmentItem,
    textureManager: TextureManager,
    elevationOffset = 0.28
  ) {
    super(parentEntity.x, parentEntity.y, 0, 0);
    this.parentEntity = parentEntity;
    this.item = item;
    this.textureManager = textureManager;
    this.elevationOffset = elevationOffset;
  }

  public update(deltaTime: number, _map: GameMap): void {
    this.x = this.parentEntity.x;
    this.y = this.parentEntity.y;
    this.active = this.parentEntity.active;

    if (this.active) {
      this.floatTimer += deltaTime * 2.8;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!this.active || !this.parentEntity.active) {
      return null;
    }

    if (!this.cardCanvas) {
      this.cardCanvas = this.createCardCanvas();
    }

    return this.cardCanvas;
  }

  public override getScale(): number {
    return this.scale;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return (
      this.parentEntity.getElevation() +
      this.elevationOffset +
      Math.sin(this.floatTimer) * 0.015
    );
  }

  public override isInteractable(): boolean {
    return false;
  }

  /**
   * Génère l'image pixel-art complète de la fiche de caractéristiques
   */
  private createCardCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 190;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const w = canvas.width;
    const h = canvas.height;
    const rarityColor = RARITY_COLORS[this.item.rarity] ?? RARITY_COLORS.common;

    // 1. Fond semi-transparent sombre avec coins biseautés pixel-art
    ctx.fillStyle = 'rgba(14, 12, 22, 0.94)';
    ctx.fillRect(4, 2, w - 8, h - 4);
    ctx.fillRect(2, 4, w - 4, h - 8);

    // 2. Bordure extérieure aux couleurs de la rareté
    ctx.fillStyle = rarityColor;
    // Lignes horizontales
    ctx.fillRect(4, 0, w - 8, 2);
    ctx.fillRect(4, h - 2, w - 8, 2);
    // Lignes verticales
    ctx.fillRect(0, 4, 2, h - 8);
    ctx.fillRect(w - 2, 4, 2, h - 8);
    // Coins en diagonale pixelisée
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillRect(w - 4, 2, 2, 2);
    ctx.fillRect(2, h - 4, 2, 2);
    ctx.fillRect(w - 4, h - 4, 2, 2);

    // Bordure intérieure sombre
    ctx.fillStyle = '#262035';
    ctx.fillRect(4, 2, w - 8, 1);
    ctx.fillRect(4, h - 3, w - 8, 1);
    ctx.fillRect(2, 4, 1, h - 8);
    ctx.fillRect(w - 3, 4, 1, h - 8);

    let currentY = 8;

    // 3. IMAGE DE L'ITEM en premier (en haut)
    const iconBoxSize = 32;
    const iconBoxX = Math.floor((w - iconBoxSize) / 2);
    const iconBoxY = currentY;

    // Cadre de l'icône
    ctx.fillStyle = '#0a0812';
    ctx.fillRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize);
    ctx.fillStyle = rarityColor;
    ctx.strokeRect(iconBoxX + 0.5, iconBoxY + 0.5, iconBoxSize - 1, iconBoxSize - 1);

    // Dessin du sprite de l'objet (centré et proportionné)
    this.drawItemIcon(ctx, iconBoxX + 2, iconBoxY + 2, iconBoxSize - 4);
    currentY += iconBoxSize + 4;

    // Petit badge de rareté sous l'icône
    const rarityLabel = RARITY_LABELS[this.item.rarity] ?? 'OBJET';
    ctx.font = '5px "Press Start 2P", monospace';
    this.drawText(ctx, `[ ${rarityLabel} ]`, w / 2, currentY + 4, rarityColor, 'center');
    currentY += 10;

    // 4. NOM DE L'ITEM avec la couleur liée à sa rareté
    ctx.font = 'bold 7px "Press Start 2P", monospace';
    const nameLines = this.wrapText(ctx, this.item.name.toUpperCase(), w - 20);
    for (const line of nameLines) {
      this.drawText(ctx, line, w / 2, currentY + 6, rarityColor, 'center');
      currentY += 9;
    }

    currentY += 3;
    this.drawSeparator(ctx, currentY, w);
    currentY += 5;

    // 5. STATS DE L'ITEM en blanc
    ctx.font = '6px "Press Start 2P", monospace';
    for (const statDef of STAT_LABELS) {
      const rawValue = this.item.stats[statDef.key];
      if (rawValue === undefined || rawValue === 0) {
        continue;
      }

      const sign = rawValue > 0 ? '+' : '';
      const text = statDef.isMultiplier
        ? `${sign}${Math.round(rawValue * 100)}% ${statDef.label}`
        : `${sign}${rawValue} ${statDef.label}`;

      this.drawText(ctx, text, w / 2, currentY + 5, '#ffffff', 'center');
      currentY += 8;
    }

    // 6. EFFET DE L'ITEM en vert s'il en a un
    if (this.item.effect && this.item.effect.trim().length > 0) {
      currentY += 2;
      this.drawSeparator(ctx, currentY, w);
      currentY += 5;

      ctx.font = '5.5px "Press Start 2P", monospace';
      const effectLines = this.wrapText(ctx, this.item.effect, w - 18);
      for (const line of effectLines) {
        this.drawText(ctx, line, w / 2, currentY + 5, '#4eff4e', 'center');
        currentY += 7.5;
      }
    }

    // 7. PETITE DESCRIPTION en jaune
    if (this.item.description && this.item.description.trim().length > 0) {
      currentY += 2;
      this.drawSeparator(ctx, currentY, w);
      currentY += 5;

      ctx.font = '5px "Press Start 2P", monospace';
      const descLines = this.wrapText(ctx, this.item.description, w - 18);
      for (const line of descLines) {
        this.drawText(ctx, line, w / 2, currentY + 5, '#ffd700', 'center');
        currentY += 7;
      }
    }

    return canvas;
  }

  private drawItemIcon(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    size = 28
  ): void {
    if (this.item.textureId !== undefined) {
      const tex = this.textureManager.getTexture(this.item.textureId);
      if (tex) {
        ctx.drawImage(tex, startX, startY, size, size);
        return;
      }
    }

    ItemSpriteManager.drawItemIcon(ctx, this.item, startX, startY, size);
  }

  private drawSeparator(
    ctx: CanvasRenderingContext2D,
    y: number,
    width: number
  ): void {
    ctx.fillStyle = '#322a45';
    ctx.fillRect(10, Math.floor(y), width - 20, 1);
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    align: CanvasTextAlign = 'center'
  ): void {
    ctx.textAlign = align;
    // Ombre portée sombre pour un contraste et une lisibilité parfaits en 3D
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}
