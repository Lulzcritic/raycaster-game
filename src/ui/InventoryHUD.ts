import type { Inventory } from '../entities/Inventory';
import type { TextureManager } from '../graphics/TextureManager';
import type { EquipmentSlot } from '../types';
import { RARITY_COLORS } from '../entities/ItemCardBillboard';

const SLOT_ICONS: Record<EquipmentSlot, readonly string[]> = {
  // Chapeau (Haut)
  hat: [
    '....xx....',
    '...xxxx...',
    '...xxxx...',
    '..xxxxxx..',
    '..xxxxxx..',
    '.xxxxxxxx.',
    'xxxxxxxxxx',
    'xxxxxxxxxx',
    '..........',
    '..........',
  ],
  // Arme (Gauche)
  weapon: [
    '.......xx.',
    '......xxxx',
    '.....xxxx.',
    '....xxxx..',
    '...xxxx...',
    '..xxxx....',
    '.xxxx.....',
    'xxxx......',
    'xxx.......',
    '.x........',
  ],
  // Armure (Droite)
  armor: [
    '.xx....xx.',
    'xxxx..xxxx',
    'xxxxxxxxxx',
    'xxxxxxxxxx',
    '.xxxxxxxx.',
    '.xxxxxxxx.',
    '.xxxxxxxx.',
    '.xxxxxxxx.',
    '..xxxxxx..',
    '..........',
  ],
  // Bottes (Bas)
  boots: [
    '..xxxx....',
    '..xxxx....',
    '..xxxx....',
    '..xxxx....',
    '..xxxx....',
    '..xxxxxxx.',
    '..xxxxxxxx',
    '..xxxxxxxx',
    '..........',
    '..........',
  ],
  // Clé (Objet de quête)
  key: [
    '...xxxx...',
    '..xx..xx..',
    '..xx..xx..',
    '...xxxx...',
    '....xx....',
    '....xxxx..',
    '....xx....',
    '....xxxx..',
    '....xx....',
    '..........',
  ],
  // Main gauche / Relique (Homonculus)
  offhand: [
    '...xxxx...',
    '..xxxxxx..',
    '.xx.xx.xx.',
    '.xxxxxxxx.',
    '..xxxxxx..',
    '..xxxxxx..',
    '.xxxxxxxx.',
    '.xxxxxxxx.',
    '..xxxxxx..',
    '...xxxx...',
  ],
};

export class InventoryHUD {
  private readonly slotSize = 18;
  private readonly centerOffset = 16;

  public render(
    ctx: CanvasRenderingContext2D,
    inventory: Inventory,
    textureManager: TextureManager
  ): void {
    const screenHeight = ctx.canvas.height;

    // Centre du losange en bas à gauche de l'écran (320x240)
    const hubX = 46;
    const hubY = screenHeight - 38;

    // Dessin du petit losange central de liaison
    this.drawCenterHub(ctx, hubX, hubY);

    // Positions des 4 slots formant le losange + slot main gauche (gauche) + slot clé (droite)
    const slots: Array<{ slot: EquipmentSlot; cx: number; cy: number }> = [
      { slot: 'hat', cx: hubX, cy: hubY - this.centerOffset },
      { slot: 'weapon', cx: hubX - this.centerOffset, cy: hubY },
      { slot: 'armor', cx: hubX + this.centerOffset, cy: hubY },
      { slot: 'boots', cx: hubX, cy: hubY + this.centerOffset },
      { slot: 'offhand', cx: hubX - 28, cy: hubY - 14 },
      { slot: 'key', cx: hubX + 28, cy: hubY - 14 },
    ];

    // Petit maillon de chaîne reliant le hub au slot de main gauche (gauche)
    ctx.fillStyle = '#4c4559';
    ctx.fillRect(hubX - 19, hubY - 7, 7, 2);
    ctx.fillStyle = '#26222e';
    ctx.fillRect(hubX - 18, hubY - 6, 5, 1);

    // Petit maillon de chaîne reliant le hub au slot de clé (droite)
    ctx.fillStyle = '#4c4559';
    ctx.fillRect(hubX + 12, hubY - 7, 7, 2);
    ctx.fillStyle = '#26222e';
    ctx.fillRect(hubX + 13, hubY - 6, 5, 1);

    for (const { slot, cx, cy } of slots) {
      this.drawSlot(ctx, cx, cy, slot, inventory, textureManager);
    }
  }

  private drawCenterHub(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number
  ): void {
    // Petit ornement pixel-art en losange au cœur des 4 slots
    ctx.fillStyle = '#14121d';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    ctx.fillStyle = '#6c6480';
    ctx.fillRect(cx - 1, cy - 3, 2, 1);
    ctx.fillRect(cx - 1, cy + 2, 2, 1);
    ctx.fillRect(cx - 3, cy - 1, 1, 2);
    ctx.fillRect(cx + 2, cy - 1, 1, 2);

    ctx.fillStyle = '#d4a024';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  private drawSlot(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    slot: EquipmentSlot,
    inventory: Inventory,
    textureManager: TextureManager
  ): void {
    const half = Math.floor(this.slotSize / 2);
    const x = cx - half;
    const y = cy - half;
    const size = this.slotSize;

    const item = inventory.getItem(slot);
    const isEquipped = item !== null;
    const rarityColor = item ? RARITY_COLORS[item.rarity] : '#ffcc00';

    // Ombre portée pixelisée
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x + 2, y + 2, size - 2, size - 2);

    // Fond du slot (biseauté aux 4 coins pour un style pixel-art)
    ctx.fillStyle = 'rgba(18, 16, 26, 0.88)';
    ctx.fillRect(x + 1, y, size - 2, size);
    ctx.fillRect(x, y + 1, size, size - 2);

    // Bordure pixelisée (couleur de rareté si un item est équipé, pierre sombre sinon)
    ctx.fillStyle = isEquipped ? rarityColor : '#706882';
    ctx.fillRect(x + 1, y, size - 2, 1); // Haut
    ctx.fillRect(x + 1, y + size - 1, size - 2, 1); // Bas
    ctx.fillRect(x, y + 1, 1, size - 2); // Gauche
    ctx.fillRect(x + size - 1, y + 1, 1, size - 2); // Droite

    // Bordure interne sombre
    ctx.fillStyle = '#2a2636';
    ctx.fillRect(x + 1, y + 1, size - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, size - 2);

    // Affichage du contenu du slot
    const iconX = x + 4;
    const iconY = y + 4;
    const iconSize = 10;

    if (item && item.textureId !== undefined) {
      const texture = textureManager.getTexture(item.textureId);
      if (texture) {
        ctx.drawImage(texture, iconX - 1, iconY - 1, iconSize + 2, iconSize + 2);
        return;
      }
    }

    // Silhouette pixel-art du type de slot (grise si vide, couleur de rareté si équipé sans texture)
    this.drawSlotSilhouette(
      ctx,
      iconX,
      iconY,
      slot,
      isEquipped ? rarityColor : '#4a435a'
    );
  }

  private drawSlotSilhouette(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    slot: EquipmentSlot,
    color: string
  ): void {
    const pattern = SLOT_ICONS[slot];
    ctx.fillStyle = color;

    for (let row = 0; row < pattern.length; row++) {
      const line = pattern[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === 'x') {
          ctx.fillRect(startX + col, startY + row, 1, 1);
        }
      }
    }
  }
}
