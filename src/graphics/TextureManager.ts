import { Door } from '../entities/Door';
import { TEXTURE_CONFIG, TEXTURE_DEFINITIONS, TILE_TYPE } from '../config/constants';
import type { TextureDefinition, TextureSource } from '../types';

// Indexe automatiquement tous les fichiers présents dans src/assets/ via Vite
const ASSET_URLS = import.meta.glob<string>('/src/assets/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

export class TextureManager {
  private readonly textures = new Map<number, HTMLCanvasElement>();
  private readonly texturePixels = new Map<number, Uint32Array>();
  public readonly textureSize: number;
  public readonly skyboxWidth: number;
  public readonly skyboxHeight: number;

  constructor(
    textureSize: number = TEXTURE_CONFIG.DEFAULT_SIZE,
    skyboxWidth: number = TEXTURE_CONFIG.SKYBOX_WIDTH,
    skyboxHeight: number = TEXTURE_CONFIG.SKYBOX_HEIGHT
  ) {
    this.textureSize = textureSize;
    this.skyboxWidth = skyboxWidth;
    this.skyboxHeight = skyboxHeight;
  }

  public getTexture(id: number): HTMLCanvasElement | undefined {
    return this.textures.get(id);
  }

  public getTexturePixels(id: number): Uint32Array | undefined {
    return this.texturePixels.get(id);
  }

  /**
   * Charge automatiquement toutes les textures déclarées dans TEXTURE_DEFINITIONS
   */
  public async loadAllTextures(
    definitions: readonly TextureDefinition[] = TEXTURE_DEFINITIONS
  ): Promise<void> {
    // Initialisation procédurale de la texture de base de la porte fermée
    const doorCanvas = Door.createClosedDoorTexture();
    this.registerTexture(TILE_TYPE.DOOR, doorCanvas);

    await Promise.all(
      definitions
        .filter((def) => def.id !== TILE_TYPE.DOOR)
        .map((def) => {
          if (def.category === 'sky') {
            return this.loadSkyboxTexture(def.path, def.id);
          }
          if (def.category === 'weapon') {
            return this.loadSpriteTexture(def.path, def.id, TEXTURE_CONFIG.WEAPON_SIZE, false);
          }
          if (def.category === 'sprite') {
            return this.loadSpriteTexture(def.path, def.id, this.textureSize, true);
          }
          return this.loadTexture(def.id, def.path);
        })
    );
  }

  /**
   * Normalise n'importe quelle image ou canvas aux dimensions cibles
   */
  public normalizeTexture(
    source: TextureSource,
    width: number = this.textureSize,
    height: number = this.textureSize,
    preserveAspectRatio = false
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Impossible d'initialiser le contexte 2D pour normaliser la texture.");
    }

    // Désactive le lissage pour un sous-échantillonnage "nearest-neighbor" (rendu pixel-art franc)
    ctx.imageSmoothingEnabled = false;

    if (preserveAspectRatio) {
      // Recadrage proportionnel ("cover") sans déformer ni étirer l'image
      const scale = Math.max(width / source.width, height / source.height);
      const srcWidth = width / scale;
      const srcHeight = height / scale;
      const srcX = (source.width - srcWidth) / 2;
      const srcY = (source.height - srcHeight) * 0.35;
      ctx.drawImage(source, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
    } else {
      ctx.drawImage(source, 0, 0, width, height);
    }

    return canvas;
  }

  public registerTexture(
    id: number,
    source: TextureSource,
    width: number = this.textureSize,
    height: number = this.textureSize,
    preserveAspectRatio = false
  ): HTMLCanvasElement {
    const normalizedCanvas = this.normalizeTexture(
      source,
      width,
      height,
      preserveAspectRatio
    );
    const ctx = normalizedCanvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, width, height);

    this.textures.set(id, normalizedCanvas);
    this.texturePixels.set(id, new Uint32Array(imageData.data.buffer));

    return normalizedCanvas;
  }

  /**
   * Supprime le fond blanc externe d'un sprite (ex: image JPG/PNG sur fond blanc) par remplissage depuis les bords
   */
  private removeWhiteBackground(canvas: HTMLCanvasElement): void {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    const isBackgroundWhiteOrTransparent = (idx: number): boolean => {
      const offset = idx * 4;
      if (data[offset + 3] < 20) {
        return true;
      }
      return data[offset] >= 200 && data[offset + 1] >= 200 && data[offset + 2] >= 200;
    };

    const tryEnqueue = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
      }
      const idx = y * width + x;
      if (visited[idx] === 0 && isBackgroundWhiteOrTransparent(idx)) {
        visited[idx] = 1;
        queue.push(idx);
      }
    };

    // Initialisation sur les 4 bords de l'image
    for (let x = 0; x < width; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      tryEnqueue(0, y);
      tryEnqueue(width - 1, y);
    }

    // Propagation (Flood-Fill) qui s'arrête dès qu'elle rencontre le contour du sprite
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      data[idx * 4 + 3] = 0; // Rend le pixel transparent

      const x = idx % width;
      const y = Math.floor(idx / width);

      tryEnqueue(x + 1, y);
      tryEnqueue(x - 1, y);
      tryEnqueue(x, y + 1);
      tryEnqueue(x, y - 1);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Recadre la zone utile (non transparente) d'un sprite 2D et l'aligne en bas du canvas cible
   * afin qu'il repose exactement sur le sol dans le monde 3D.
   */
  private alignSpriteToBottom(canvas: HTMLCanvasElement, targetSize: number): HTMLCanvasElement {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, width, height).data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return canvas;
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;

    const scale = Math.min(targetSize / contentWidth, targetSize / contentHeight);
    const drawWidth = Math.max(1, Math.round(contentWidth * scale));
    const drawHeight = Math.max(1, Math.round(contentHeight * scale));
    const drawX = Math.floor((targetSize - drawWidth) / 2);
    const drawY = targetSize - drawHeight; // Aligné tout en bas du canvas

    const alignedCanvas = document.createElement('canvas');
    alignedCanvas.width = targetSize;
    alignedCanvas.height = targetSize;
    const alignedCtx = alignedCanvas.getContext('2d')!;
    alignedCtx.imageSmoothingEnabled = false;

    alignedCtx.drawImage(
      canvas,
      minX,
      minY,
      contentWidth,
      contentHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );

    return alignedCanvas;
  }

  /**
   * Résout un chemin de texture (supporte src/assets/..., /assets/..., textures/..., ou public/)
   */
  private resolveAssetUrl(url: string): string {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    const candidates = [
      normalized,
      `/src${normalized}`,
      `/src/assets${normalized}`,
    ];

    for (const candidate of candidates) {
      if (candidate in ASSET_URLS) {
        return ASSET_URLS[candidate];
      }
    }

    return url;
  }

  /**
   * Charge une image de texture (64x64 par défaut) et l'associe à un identifiant
   */
  public loadTexture(
    id: number,
    url: string,
    width: number = this.textureSize,
    height: number = this.textureSize,
    preserveAspectRatio = false
  ): Promise<HTMLCanvasElement> {
    const resolvedUrl = this.resolveAssetUrl(url);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const normalizedCanvas = this.registerTexture(
          id,
          img,
          width,
          height,
          preserveAspectRatio
        );
        resolve(normalizedCanvas);
      };
      img.onerror = () => {
        reject(new Error(`Impossible de charger la texture : ${url} (résolu en : ${resolvedUrl})`));
      };
      img.src = resolvedUrl;
    });
  }

  /**
   * Charge un sprite 2D (arme ou objet du monde), détoure son fond blanc et le normalise en pixel-art
   */
  public async loadSpriteTexture(
    url: string,
    id: number,
    size: number = this.textureSize,
    alignBottom = true
  ): Promise<HTMLCanvasElement> {
    const resolvedUrl = this.resolveAssetUrl(url);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error(`Impossible de charger le sprite : ${url} (résolu en : ${resolvedUrl})`));
      image.src = resolvedUrl;
    });

    let canvas = this.normalizeTexture(img, size, size, false);
    this.removeWhiteBackground(canvas);

    if (alignBottom) {
      canvas = this.alignSpriteToBottom(canvas, size);
    }

    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, size, size);
    this.textures.set(id, canvas);
    this.texturePixels.set(id, new Uint32Array(imageData.data.buffer));

    return canvas;
  }

  /**
   * Charge une texture de Skybox en conservant ses proportions d'origine (320x120)
   */
  public loadSkyboxTexture(
    url: string,
    id: number = TILE_TYPE.SKY_1
  ): Promise<HTMLCanvasElement> {
    return this.loadTexture(id, url, this.skyboxWidth, this.skyboxHeight, true);
  }

  /**
   * Raccourci pour charger la texture principale du sol (ID = 0)
   */
  public loadFloorTexture(url: string): Promise<HTMLCanvasElement> {
    return this.loadTexture(TILE_TYPE.GROUND_1, url);
  }

  /**
   * Découpe une spritesheet (tileset) et normalise chaque tuile en 64x64
   */
  public async loadSpriteSheet(
    url: string,
    tileSize: number,
    mapping: Record<number, { col: number; row: number }>
  ): Promise<void> {
    const resolvedUrl = this.resolveAssetUrl(url);

    const sheet = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error(`Impossible de charger la spritesheet : ${url} (résolu en : ${resolvedUrl})`));
      img.src = resolvedUrl;
    });

    for (const [idStr, coords] of Object.entries(mapping)) {
      const id = Number(idStr);
      const canvas = document.createElement('canvas');
      canvas.width = this.textureSize;
      canvas.height = this.textureSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheet,
          coords.col * tileSize,
          coords.row * tileSize,
          tileSize,
          tileSize,
          0,
          0,
          this.textureSize,
          this.textureSize
        );
        this.registerTexture(id, canvas);
      }
    }
  }
}
