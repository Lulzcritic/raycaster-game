import sprite1_1 from '../assets/sprites/ennemies/goblin/sprite-1-1.png';
import sprite1_3 from '../assets/sprites/ennemies/goblin/sprite-1-3.png';
import sprite1_6 from '../assets/sprites/ennemies/goblin/sprite-1-6.png';
import type { EnemyState } from '../entities/Enemy';

/**
 * Gestionnaire d'animation et de rendu du Gobelin au Trésor.
 * Normalise les 3 frames du cycle de course avec son sac d'or,
 * produit la démarche rapide, la silhouette blanche de dégât et la pose de défaite.
 */
export class GoblinSpriteManager {
  private static readonly runFrames: HTMLCanvasElement[] = [];
  private static readonly hurtFrames: HTMLCanvasElement[] = [];
  private static deadFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge les sprites du Gobelin et génère les toiles d'animation normalisées
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spriteUrls = [sprite1_1, sprite1_3, sprite1_6];
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
              console.error(`Impossible de charger le sprite du gobelin : ${url}`);
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

    // Échelle uniforme pour préserver les proportions exactes entre chaque foulée
    const availableSize = 230;
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
      this.runFrames[i] = canvas;

      // Toile de dégât : silhouette blanche/dorée avec légère lueur
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(255, 245, 230, 0.88)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.hurtFrames[i] = hurtCanvas;
    }

    // Pose de défaite : gobelin et sac étalés au sol
    if (this.runFrames[0]) {
      const baseCanvas = this.runFrames[0];
      const deadCanvas = document.createElement('canvas');
      deadCanvas.width = canvasSize;
      deadCanvas.height = canvasSize;
      const dCtx = deadCanvas.getContext('2d')!;
      const squashedH = Math.round(canvasSize * 0.32);
      const squashedY = canvasSize - squashedH;
      dCtx.drawImage(baseCanvas, 0, squashedY, canvasSize, squashedH);
      dCtx.globalCompositeOperation = 'source-atop';
      dCtx.fillStyle = 'rgba(30, 20, 10, 0.45)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite approprié selon l'état et l'avancement temporel du gobelin
   */
  public static getSprite(
    state: EnemyState,
    animTimer: number,
    _stateTimer: number
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || this.runFrames.length === 0) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.runFrames[0];
    }

    // Cycle de course à 4 temps (0 -> 1 -> 2 -> 1)
    const runSequence = [0, 1, 2, 1];
    const seqIdx = Math.floor(animTimer * 8.5) % runSequence.length;
    const frameIdx = runSequence[seqIdx] ?? 0;

    if (state === 'hurt') {
      return this.hurtFrames[frameIdx] ?? this.runFrames[frameIdx];
    }

    if (state === 'aggro') {
      return this.runFrames[frameIdx];
    }

    // Idle : respiration légère entre les frames 0 et 1
    const idleIdx = Math.floor(animTimer * 2.0) % 2;
    return this.runFrames[idleIdx] ?? this.runFrames[0];
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(20, 24, 24, 28);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(14, 18, 16, 20); // sac d'or
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
