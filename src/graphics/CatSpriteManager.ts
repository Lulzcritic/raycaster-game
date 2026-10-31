export type CatVisualState = 'wandering' | 'idle' | 'purring' | 'sleeping';

const idle1Url = new URL('../assets/sprites/cat/idle.png', import.meta.url).href;
const idle2Url = new URL('../assets/sprites/cat/idle2.png', import.meta.url).href;
const idle3Url = new URL('../assets/sprites/cat/idle3.png', import.meta.url).href;
const idle4Url = new URL('../assets/sprites/cat/idle4.png', import.meta.url).href;

const purr1Url = new URL('../assets/sprites/cat/purr.png', import.meta.url).href;
const purr2Url = new URL('../assets/sprites/cat/purr2.png', import.meta.url).href;

const sleepUrl = new URL('../assets/sprites/cat/sleep.png', import.meta.url).href;

const walk1Url = new URL('../assets/sprites/cat/walk.png', import.meta.url).href;
const walk2Url = new URL('../assets/sprites/cat/walk2.png', import.meta.url).href;
const walk3Url = new URL('../assets/sprites/cat/walk3.png', import.meta.url).href;

/**
 * Gestionnaire d'animation et de rendu des chats compagnons de la Citadelle :
 * - Marche fluide (walk1 -> walk2 -> walk3 -> walk2)
 * - Posture assise curieuse (idle1 -> idle2 -> idle3 -> idle4)
 * - Ronronnement réconfortant (purr1 -> purr2)
 * - Sommeil paisible recroquevillé (sleep)
 * Toutes les poses sont normalisées sur une toile 256x256 avec ancrage naturel au sol.
 */
export class CatSpriteManager {
  private static readonly walkFrames: HTMLCanvasElement[] = [];
  private static readonly idleFrames: HTMLCanvasElement[] = [];
  private static readonly purrFrames: HTMLCanvasElement[] = [];
  private static sleepFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  public static async preloadAll(): Promise<void> {
    if (this.isInitialized || typeof document === 'undefined') {
      return;
    }

    const spriteEntries = [
      { key: 'idle1', url: idle1Url },
      { key: 'idle2', url: idle2Url },
      { key: 'idle3', url: idle3Url },
      { key: 'idle4', url: idle4Url },
      { key: 'purr1', url: purr1Url },
      { key: 'purr2', url: purr2Url },
      { key: 'sleep', url: sleepUrl },
      { key: 'walk1', url: walk1Url },
      { key: 'walk2', url: walk2Url },
      { key: 'walk3', url: walk3Url },
    ];

    const loadedImages = new Map<string, HTMLImageElement>();

    await Promise.all(
      spriteEntries.map(
        ({ key, url }) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              loadedImages.set(key, img);
              resolve();
            };
            img.onerror = () => {
              console.error(`Impossible de charger le sprite du chat (${key}) : ${url}`);
              resolve();
            };
            img.src = url;
          })
      )
    );

    const canvasSize = 256;
    let maxW = 1;
    let maxH = 1;

    for (const img of loadedImages.values()) {
      if (img.width > maxW) maxW = img.width;
      if (img.height > maxH) maxH = img.height;
    }

    // Échelle uniforme pour préserver les proportions naturelles relatives
    const availableSize = 220;
    const uniformScale = Math.min(availableSize / maxW, availableSize / maxH);

    const createBottomAnchoredCanvas = (img: HTMLImageElement | undefined): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx || !img) {
        return canvas;
      }
      ctx.imageSmoothingEnabled = true;

      const destW = Math.round(img.width * uniformScale);
      const destH = Math.round(img.height * uniformScale);
      const destX = Math.round((canvasSize - destW) / 2);
      const destY = canvasSize - destH; // Ancré au sol

      ctx.drawImage(img, destX, destY, destW, destH);
      return canvas;
    };

    // Marche (walk1, walk2, walk3, walk2)
    const w1 = createBottomAnchoredCanvas(loadedImages.get('walk1'));
    const w2 = createBottomAnchoredCanvas(loadedImages.get('walk2'));
    const w3 = createBottomAnchoredCanvas(loadedImages.get('walk3'));
    this.walkFrames.length = 0;
    this.walkFrames.push(w1, w2, w3, w2);

    // Repos / Observation (idle1, idle2, idle3, idle4)
    this.idleFrames.length = 0;
    this.idleFrames.push(
      createBottomAnchoredCanvas(loadedImages.get('idle1')),
      createBottomAnchoredCanvas(loadedImages.get('idle2')),
      createBottomAnchoredCanvas(loadedImages.get('idle3')),
      createBottomAnchoredCanvas(loadedImages.get('idle4'))
    );

    // Ronronnement (purr1, purr2)
    this.purrFrames.length = 0;
    this.purrFrames.push(
      createBottomAnchoredCanvas(loadedImages.get('purr1')),
      createBottomAnchoredCanvas(loadedImages.get('purr2'))
    );

    // Sommeil (sleep)
    this.sleepFrame = createBottomAnchoredCanvas(loadedImages.get('sleep'));

    this.isInitialized = true;
  }

  public static getSprite(state: CatVisualState, animTimer: number): HTMLCanvasElement | null {
    if (state === 'sleeping') {
      return this.sleepFrame ?? this.getFallback();
    }

    if (state === 'purring') {
      if (this.purrFrames.length > 0) {
        const frameIdx = Math.floor(animTimer / 0.20) % this.purrFrames.length;
        return this.purrFrames[frameIdx];
      }
      return this.getFallback();
    }

    if (state === 'idle') {
      if (this.idleFrames.length > 0) {
        const frameIdx = Math.floor(animTimer / 0.35) % this.idleFrames.length;
        return this.idleFrames[frameIdx];
      }
      return this.getFallback();
    }

    // Wandering
    if (this.walkFrames.length > 0) {
      const frameIdx = Math.floor(animTimer / 0.16) % this.walkFrames.length;
      return this.walkFrames[frameIdx];
    }

    return this.getFallback();
  }

  private static getFallback(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') {
      return null;
    }
    if (!this.fallbackCanvas) {
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.width = 64;
      this.fallbackCanvas.height = 64;
      const ctx = this.fallbackCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(32, 44, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(20, 32);
        ctx.lineTo(16, 16);
        ctx.lineTo(28, 26);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(44, 32);
        ctx.lineTo(48, 16);
        ctx.lineTo(36, 26);
        ctx.fill();
      }
    }
    return this.fallbackCanvas;
  }
}
