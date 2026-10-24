import sprite1_1 from '../assets/sprites/ennemies/mimic/sprite-1-1.png';
import sprite1_2 from '../assets/sprites/ennemies/mimic/sprite-1-2.png';
import sprite2_1 from '../assets/sprites/ennemies/mimic/sprite-2-1.png';
import sprite2_2 from '../assets/sprites/ennemies/mimic/sprite-2-2.png';
import type { EnemyState } from '../entities/Enemy';

/**
 * Gestionnaire d'animation et de rendu du Mimic.
 * Normalise les 4 frames du cycle de marche du monstre (sprite-1-1 à sprite-2-2)
 * et produit les poses d'attaque, de dégât (flash blanc) et de mort.
 */
export class MimicSpriteManager {
  private static readonly walkFrames: HTMLCanvasElement[] = [];
  private static readonly hurtFrames: HTMLCanvasElement[] = [];
  private static attackFrame: HTMLCanvasElement | null = null;
  private static deadFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge les images du Mimic et génère les toiles d'animation normalisées
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spriteUrls = [sprite1_1, sprite1_2, sprite2_1, sprite2_2];
    const images: HTMLImageElement[] = new Array(spriteUrls.length);

    await Promise.all(
      spriteUrls.map(
        (url, idx) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              images[idx] = img;
              resolve();
            };
            img.onerror = () => {
              console.error(`Impossible de charger le sprite du mimic : ${url}`);
              resolve();
            };
            img.src = url;
          })
      )
    );

    const canvasSize = 256;
    let maxW = 1;
    let maxH = 1;

    for (const img of images) {
      if (img) {
        if (img.width > maxW) maxW = img.width;
        if (img.height > maxH) maxH = img.height;
      }
    }

    // Échelle uniforme pour préserver les proportions exactes entre chaque frame
    const availableSize = 240;
    const uniformScale = Math.min(availableSize / maxW, availableSize / maxH);

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img) continue;

      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;

      const destW = Math.round(img.width * uniformScale);
      const destH = Math.round(img.height * uniformScale);
      const destX = Math.round((canvasSize - destW) / 2);
      const destY = canvasSize - destH; // Ancré au bas de la toile (sol)

      ctx.drawImage(img, destX, destY, destW, destH);
      this.walkFrames[i] = canvas;

      // Toile de dégât : silhouette blanche avec légère lueur rouge
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(255, 230, 230, 0.88)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.hurtFrames[i] = hurtCanvas;
    }

    // La frame 2 (sprite-2-1) possède la gueule grande ouverte et les yeux incandescents
    this.attackFrame = this.walkFrames[2] ?? this.walkFrames[0] ?? null;

    // Frame d'élimination : coffre écrasé au sol
    if (this.walkFrames[0]) {
      const baseCanvas = this.walkFrames[0];
      const deadCanvas = document.createElement('canvas');
      deadCanvas.width = canvasSize;
      deadCanvas.height = canvasSize;
      const dCtx = deadCanvas.getContext('2d')!;
      const squashedH = Math.round(canvasSize * 0.32);
      const squashedY = canvasSize - squashedH;
      dCtx.drawImage(baseCanvas, 0, squashedY, canvasSize, squashedH);
      dCtx.globalCompositeOperation = 'source-atop';
      dCtx.fillStyle = 'rgba(30, 15, 10, 0.4)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite approprié selon l'état et l'avancement temporel de l'ennemi
   */
  public static getSprite(
    state: EnemyState,
    animTimer: number,
    _stateTimer: number
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || this.walkFrames.length === 0) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.walkFrames[0];
    }

    if (state === 'hurt') {
      const frameIdx = Math.floor(animTimer * 7.5) % this.walkFrames.length;
      return this.hurtFrames[frameIdx] ?? this.walkFrames[frameIdx];
    }

    if (state === 'attacking') {
      return this.attackFrame ?? this.walkFrames[0];
    }

    if (state === 'aggro') {
      // Cycle de course : 0 -> 1 -> 2 -> 3
      const frameIdx = Math.floor(animTimer * 7.5) % this.walkFrames.length;
      return this.walkFrames[frameIdx];
    }

    // Respiration au repos (alternance lente entre 0 et 1)
    const idleIdx = Math.floor(animTimer * 2.0) % 2;
    return this.walkFrames[idleIdx] ?? this.walkFrames[0];
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#6e4a2e';
    ctx.fillRect(16, 24, 32, 24);
    ctx.fillStyle = '#ff3300';
    ctx.fillRect(24, 32, 6, 6);
    ctx.fillRect(34, 32, 6, 6);
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
