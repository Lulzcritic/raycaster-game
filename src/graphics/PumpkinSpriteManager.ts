import walk1Url from '../assets/sprites/ennemies/pumpkin/walk.png';
import walk2Url from '../assets/sprites/ennemies/pumpkin/walk2.png';
import walk3Url from '../assets/sprites/ennemies/pumpkin/walk3.png';
import type { EnemyState } from '../entities/Enemy';

/**
 * Gestionnaire d'animation et de rendu de la Citrouille Ensorcelée et de ses Graines.
 * Normalise les 3 frames de la citrouille (walk, walk2, walk3) et génère
 * les sprites animés de la graine (pulsation, fissuration avant éclosion, flash de dégât).
 */
export class PumpkinSpriteManager {
  private static readonly walkFrames: HTMLCanvasElement[] = [];
  private static readonly hurtFrames: HTMLCanvasElement[] = [];
  private static deadFrame: HTMLCanvasElement | null = null;

  // Sprites de la Graine de Citrouille
  private static seedNormalFrame: HTMLCanvasElement | null = null;
  private static seedPulseFrame: HTMLCanvasElement | null = null;
  private static seedCrackingFrame: HTMLCanvasElement | null = null;
  private static seedHurtFrame: HTMLCanvasElement | null = null;
  private static seedDeadFrame: HTMLCanvasElement | null = null;

  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge les sprites de la Citrouille et produit les toiles d'animation normalisées
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spriteUrls = [walk1Url, walk2Url, walk3Url];
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
              console.error(`Impossible de charger le sprite de la citrouille : ${url}`);
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

    const availableSize = 236;
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
      this.walkFrames.push(canvas);

      // Silhouette lumineuse dorée/orangée lors des dégâts reçus
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(255, 245, 210, 0.92)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.hurtFrames.push(hurtCanvas);
    }

    // Pose de défaite : citrouille écrasée et fissurée au sol
    if (this.walkFrames[0]) {
      const baseCanvas = this.walkFrames[0];
      const deadCanvas = document.createElement('canvas');
      deadCanvas.width = canvasSize;
      deadCanvas.height = canvasSize;
      const dCtx = deadCanvas.getContext('2d')!;
      const squashedH = Math.round(canvasSize * 0.28);
      const squashedY = canvasSize - squashedH;
      dCtx.drawImage(baseCanvas, 0, squashedY, canvasSize, squashedH);
      dCtx.globalCompositeOperation = 'source-atop';
      dCtx.fillStyle = 'rgba(50, 20, 0, 0.5)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    // Génération des sprites de la Graine de Citrouille
    this.createSeedSprites();

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite adapté de la Citrouille
   */
  public static getPumpkinSprite(
    state: EnemyState,
    animTimer: number,
    isMoving: boolean
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || this.walkFrames.length === 0) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.walkFrames[0] ?? null;
    }

    // Pose d'attaque au corps à corps : morsure agressive (frame 2)
    if (state === 'attacking') {
      return this.walkFrames[2] ?? this.walkFrames[0]!;
    }

    // Cycle de déplacement à 4 temps (0 -> 1 -> 2 -> 1)
    const walkSequence = [0, 1, 2, 1];
    const seqIdx = isMoving
      ? Math.floor(animTimer * 6.5) % walkSequence.length
      : 0;
    const frameIdx = walkSequence[seqIdx] ?? 0;

    if (state === 'hurt') {
      return this.hurtFrames[frameIdx] ?? this.walkFrames[frameIdx] ?? this.walkFrames[0]!;
    }

    return this.walkFrames[frameIdx] ?? this.walkFrames[0]!;
  }

  /**
   * Retourne le sprite adapté de la Graine de Citrouille posée au sol
   * @param state État de la graine (idle, hurt, dead)
   * @param animTimer Timer d'animation globale
   * @param hatchProgress Progression vers l'éclosion (0 à 1)
   */
  public static getSeedSprite(
    state: EnemyState,
    animTimer: number,
    hatchProgress: number
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || !this.seedNormalFrame) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.seedDeadFrame ?? this.seedNormalFrame;
    }

    if (state === 'hurt') {
      return this.seedHurtFrame ?? this.seedNormalFrame;
    }

    // Lorsque la graine est sur le point d'éclore (progression > 0.68) : elle tremble et se fissure
    if (hatchProgress > 0.68) {
      return this.seedCrackingFrame ?? this.seedPulseFrame ?? this.seedNormalFrame;
    }

    // Pulsation lente de la graine
    const isPulsing = Math.sin(animTimer * 5.0) > 0;
    return isPulsing ? this.seedPulseFrame : this.seedNormalFrame;
  }

  /**
   * Crée les sprites pixel-art de la graine de citrouille sur toiles 64x64 ancrées au sol
   */
  private static createSeedSprites(): void {
    const size = 64;

    this.seedNormalFrame = this.renderSeedCanvas(size, false, false);
    this.seedPulseFrame = this.renderSeedCanvas(size, true, false);
    this.seedCrackingFrame = this.renderSeedCanvas(size, true, true);

    // Frame de dégât reçu (flash blanc/vert)
    const hurtCanvas = document.createElement('canvas');
    hurtCanvas.width = size;
    hurtCanvas.height = size;
    const hCtx = hurtCanvas.getContext('2d')!;
    hCtx.drawImage(this.seedNormalFrame, 0, 0);
    hCtx.globalCompositeOperation = 'source-atop';
    hCtx.fillStyle = 'rgba(255, 255, 220, 0.92)';
    hCtx.fillRect(0, 0, size, size);
    this.seedHurtFrame = hurtCanvas;

    // Frame d'élimination : graine écrasée en éclats
    const deadCanvas = document.createElement('canvas');
    deadCanvas.width = size;
    deadCanvas.height = size;
    const dCtx = deadCanvas.getContext('2d')!;
    dCtx.drawImage(this.seedNormalFrame, 0, size * 0.45, size, size * 0.55);
    dCtx.globalCompositeOperation = 'source-atop';
    dCtx.fillStyle = 'rgba(30, 40, 10, 0.65)';
    dCtx.fillRect(0, 0, size, size);
    this.seedDeadFrame = deadCanvas;
  }

  private static renderSeedCanvas(
    size: number,
    pulse: boolean,
    cracking: boolean
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const cx = size / 2;
    const baseY = size - 4; // Ancré au bas du canvas

    // 1. Petite motte de terre sombre et racines autour
    ctx.fillStyle = '#291809';
    ctx.fillRect(cx - 16, baseY - 4, 32, 4);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 12, baseY - 6, 24, 3);

    // 2. Coque de la graine (forme ovoïde pointue vers le haut)
    // Contour vert sombre
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 18, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Remplissage émeraude et olive
    ctx.fillStyle = pulse ? '#65a30d' : '#4d7c0f';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 18, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nervures végétales orangées palpitantes
    ctx.fillStyle = pulse ? '#fbbf24' : '#f97316';
    ctx.fillRect(cx - 1, baseY - 32, 2, 24);
    ctx.fillRect(cx - 6, baseY - 22, 12, 2);
    ctx.fillRect(cx - 8, baseY - 15, 16, 2);

    // Petite tige / pousse au sommet
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(cx - 2, baseY - 35, 4, 4);
    ctx.fillRect(cx - 4, baseY - 38, 3, 4);

    // 3. Fissure lumineuse si prête à éclore
    if (cracking) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, baseY - 28, 4, 3);
      ctx.fillRect(cx - 1, baseY - 25, 5, 4);
      ctx.fillRect(cx - 4, baseY - 21, 6, 3);
      ctx.fillRect(cx - 2, baseY - 18, 5, 4);
      ctx.fillRect(cx - 3, baseY - 14, 6, 3);

      // Éclats dorés jaillissants
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 9, baseY - 24, 2, 2);
      ctx.fillRect(cx + 8, baseY - 20, 2, 2);
      ctx.fillRect(cx + 6, baseY - 30, 2, 2);
    }

    return canvas;
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(16, 16, 32, 32);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(22, 22, 6, 6);
    ctx.fillRect(36, 22, 6, 6);
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
