import type { EquipmentItem, EquipmentSlot, ItemRarity } from '../types';
import { RARITY_COLORS } from '../entities/ItemCardBillboard';
import homonculusUrl from '../assets/textures/homonculus.png';

// Indexe automatiquement tous les sprites découpés et renommés par rareté
const SPRITE_ASSETS: Record<string, string> = import.meta.glob<string>(
  '/src/assets/sprites/**/*.png',
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
);

const SLOT_TO_FOLDER: Partial<Record<EquipmentSlot, string>> = {
  boots: 'boots',
  hat: 'hats',
  armor: 'chest',
  weapon: 'wand',
};

export class ItemSpriteManager {
  private static readonly imageCache = new Map<string, HTMLImageElement>();
  private static readonly worldCanvasCache = new Map<string, HTMLCanvasElement>();
  private static isInitialized = false;

  /**
   * Retourne l'URL de la texture du sprite correspondant au slot et à la rareté
   */
  public static getSpriteUrl(
    slot: EquipmentSlot,
    rarity: ItemRarity,
    itemId?: string
  ): string | null {
    if (slot === 'offhand' || itemId === 'offhand_homonculus') {
      return homonculusUrl;
    }

    const folder = SLOT_TO_FOLDER[slot];
    if (!folder) {
      return null;
    }

    const primaryKey = `/src/assets/sprites/${folder}/${rarity}.png`;
    if (primaryKey in SPRITE_ASSETS) {
      return SPRITE_ASSETS[primaryKey];
    }

    // Repli de secours vers le rang légendaire si l'artéfact n'existe pas pour ce slot
    if (rarity === 'artifact') {
      const fallbackKey = `/src/assets/sprites/${folder}/legendary.png`;
      if (fallbackKey in SPRITE_ASSETS) {
        return SPRITE_ASSETS[fallbackKey];
      }
    }

    return null;
  }

  /**
   * Retourne l'URL du sprite pour un équipement donné
   */
  public static getItemSpriteUrl(item: EquipmentItem): string | null {
    return this.getSpriteUrl(item.slot, item.rarity, item.id);
  }

  /**
   * Initialise et précharge tous les sprites d'objets pour un rendu fluide et immédiat
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const promises: Array<Promise<void>> = [];

    // 1. Préchargement des sprites d'équipement
    for (const [key, url] of Object.entries(SPRITE_ASSETS)) {
      promises.push(this.loadImage(key, url));
    }

    // 2. Préchargement de l'homonculus
    promises.push(this.loadImage('offhand_homonculus', homonculusUrl));

    await Promise.all(promises);
    this.isInitialized = true;
  }

  private static loadImage(cacheKey: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(cacheKey, img);
        resolve();
      };
      img.onerror = () => {
        resolve(); // Continue malgré tout en cas de fichier manquant
      };
      img.src = url;
    });
  }

  /**
   * Récupère l'image HTMLImageElement chargée pour un objet
   */
  public static getItemImage(item: EquipmentItem): HTMLImageElement | null {
    if (item.slot === 'offhand' || item.id === 'offhand_homonculus') {
      let img = this.imageCache.get('offhand_homonculus');
      if (!img) {
        img = new Image();
        img.src = homonculusUrl;
        this.imageCache.set('offhand_homonculus', img);
      }
      return img;
    }

    const folder = SLOT_TO_FOLDER[item.slot];
    if (!folder) {
      return null;
    }

    const primaryKey = `/src/assets/sprites/${folder}/${item.rarity}.png`;
    let img = this.imageCache.get(primaryKey);
    if (!img) {
      const url = SPRITE_ASSETS[primaryKey];
      if (url) {
        img = new Image();
        img.src = url;
        this.imageCache.set(primaryKey, img);
      } else if (item.rarity === 'artifact') {
        const fallbackKey = `/src/assets/sprites/${folder}/legendary.png`;
        img = this.imageCache.get(fallbackKey);
        if (!img && fallbackKey in SPRITE_ASSETS) {
          img = new Image();
          img.src = SPRITE_ASSETS[fallbackKey];
          this.imageCache.set(fallbackKey, img);
        }
      }
    }

    return img ?? null;
  }

  /**
   * Génère ou récupère le canvas d'un objet posé au sol dans le monde 3D
   * (Centré, détouré, proportionné et avec une aura subtile de rareté à la base)
   */
  public static getItemWorldCanvas(item: EquipmentItem): HTMLCanvasElement {
    const cacheKey = `${item.slot}_${item.rarity}_${item.id}`;
    const cached = this.worldCanvasCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement('canvas');
    const targetSize = 128;
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const img = this.getItemImage(item);
    const rarityColor = RARITY_COLORS[item.rarity] ?? '#ffffff';

    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const padBottom = 8;
      const availWidth = targetSize - 16;
      const availHeight = targetSize - padBottom - 8;

      const scale = Math.min(availWidth / img.naturalWidth, availHeight / img.naturalHeight);
      const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
      const drawH = Math.max(1, Math.round(img.naturalHeight * scale));
      const drawX = Math.round((targetSize - drawW) / 2);
      const drawY = Math.round(targetSize - padBottom - drawH);

      // Halo lumineux circulaire au sol sous l'objet
      const groundY = targetSize - padBottom;
      const auraGradient = ctx.createRadialGradient(
        targetSize / 2,
        groundY,
        2,
        targetSize / 2,
        groundY,
        Math.max(16, drawW * 0.45)
      );
      auraGradient.addColorStop(0, `${rarityColor}aa`);
      auraGradient.addColorStop(0.5, `${rarityColor}44`);
      auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(targetSize / 2, groundY / 0.4, Math.max(16, drawW * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();
      ctx.restore();

      // Dessin du sprite avec netteté pixel-art
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else if (item.slot === 'key') {
      this.drawPixelKey(ctx, 48, 48, 32, rarityColor);
    } else {
      // Repli si le sprite n'est pas encore prêt : sphère de rareté
      this.drawFallbackOrb(ctx, targetSize, rarityColor);
    }

    this.worldCanvasCache.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * Dessine l'icône de l'objet dans un canvas UI aux dimensions souhaitées
   */
  public static renderToCanvas(
    targetCanvas: HTMLCanvasElement,
    item: EquipmentItem
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    this.drawItemIcon(ctx, item, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  /**
   * Dessine l'icône pixel-art de l'objet centrée dans une boîte (boxW x boxH)
   */
  public static drawItemIcon(
    ctx: CanvasRenderingContext2D,
    item: EquipmentItem,
    x: number,
    y: number,
    boxW: number,
    boxH: number = boxW
  ): void {
    const img = this.getItemImage(item);
    const rarityColor = RARITY_COLORS[item.rarity] ?? '#ffffff';

    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
      const drawH = Math.max(1, Math.round(img.naturalHeight * scale));
      const drawX = Math.round(x + (boxW - drawW) / 2);
      const drawY = Math.round(y + (boxH - drawH) / 2);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else if (item.slot === 'key') {
      this.drawPixelKey(ctx, x, y, Math.min(boxW, boxH), rarityColor);
    } else {
      this.drawFallbackIcon(ctx, x, y, Math.min(boxW, boxH), rarityColor);
    }
  }

  private static drawPixelKey(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const s = Math.max(1, Math.floor(size / 8));

    // Anneau de la clé
    ctx.fillRect(cx - 3 * s, cy - 3 * s, 6 * s, 2 * s);
    ctx.fillRect(cx - 3 * s, cy - s, 2 * s, 2 * s);
    ctx.fillRect(cx + s, cy - s, 2 * s, 2 * s);
    ctx.fillRect(cx - 3 * s, cy + s, 6 * s, 2 * s);
    // Tige
    ctx.fillRect(cx - s, cy + 3 * s, 2 * s, 4 * s);
    // Dents
    ctx.fillRect(cx + s, cy + 4 * s, 2 * s, s);
    ctx.fillRect(cx + s, cy + 6 * s, 2 * s, s);
    ctx.restore();
  }

  private static drawFallbackOrb(
    ctx: CanvasRenderingContext2D,
    size: number,
    color: string
  ): void {
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.floor(size * 0.28);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private static drawFallbackIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    const pad = Math.floor(size * 0.2);
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
  }
}
