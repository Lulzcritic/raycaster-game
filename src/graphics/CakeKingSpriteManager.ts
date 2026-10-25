import walk1Url from '../assets/sprites/ennemies/cakeKing/walk.png';
import walk2Url from '../assets/sprites/ennemies/cakeKing/walk2.png';
import walk3Url from '../assets/sprites/ennemies/cakeKing/walk3.png';
import attackUrl from '../assets/sprites/ennemies/cakeKing/attack.png';
import attack2Url from '../assets/sprites/ennemies/cakeKing/attack2.png';
import type { EnemyState } from '../entities/Enemy';

export type CakeKingAttackKind = 'none' | 'slide' | 'melee';

/**
 * Gestionnaire d'animation et de rendu du Carrot Cake King (Roi Gâteau à la Carotte),
 * Boss final de la Zone 3.
 * Normalise les 5 poses haute définition (walk1, walk2, walk3, attack/glissade, attack2/corps-à-corps)
 * sur une toile 256x256 avec ancrage au sol, silhouette de dégât dorée/crème et pose de défaite.
 */
export class CakeKingSpriteManager {
  private static walk1Canvas: HTMLCanvasElement | null = null;
  private static walk1HurtCanvas: HTMLCanvasElement | null = null;

  private static walk2Canvas: HTMLCanvasElement | null = null;
  private static walk2HurtCanvas: HTMLCanvasElement | null = null;

  private static walk3Canvas: HTMLCanvasElement | null = null;
  private static walk3HurtCanvas: HTMLCanvasElement | null = null;

  // Attaque 1 : Glissade aérodynamique vers le joueur
  private static slideCanvas: HTMLCanvasElement | null = null;
  private static slideHurtCanvas: HTMLCanvasElement | null = null;

  // Attaque 2 : Frappe puissante au corps à corps
  private static meleeCanvas: HTMLCanvasElement | null = null;
  private static meleeHurtCanvas: HTMLCanvasElement | null = null;

  private static deadFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge les 5 toiles d'animation du Carrot Cake King
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spriteEntries = [
      { key: 'walk1', url: walk1Url },
      { key: 'walk2', url: walk2Url },
      { key: 'walk3', url: walk3Url },
      { key: 'attack', url: attackUrl },
      { key: 'attack2', url: attack2Url },
    ];

    const images: Record<string, HTMLImageElement> = {};

    await Promise.all(
      spriteEntries.map(
        ({ key, url }) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              images[key] = img;
              resolve();
            };
            img.onerror = () => {
              console.error(`Impossible de charger le sprite du Carrot Cake King (${key}) : ${url}`);
              resolve();
            };
            img.src = url;
          })
      )
    );

    let maxW = 1;
    let maxH = 1;
    for (const key of Object.keys(images)) {
      const img = images[key];
      if (img) {
        if (img.width > maxW) maxW = img.width;
        if (img.height > maxH) maxH = img.height;
      }
    }

    const canvasSize = 256;
    const availableSize = 238;
    const uniformScale = Math.min(availableSize / maxW, availableSize / maxH);

    const processImage = (
      img: HTMLImageElement | undefined
    ): { normal: HTMLCanvasElement | null; hurt: HTMLCanvasElement | null } => {
      if (!img) return { normal: null, hurt: null };

      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;

      const destW = Math.round(img.width * uniformScale);
      const destH = Math.round(img.height * uniformScale);
      const destX = Math.round((canvasSize - destW) / 2);
      const destY = canvasSize - destH; // Ancré au sol

      ctx.drawImage(img, destX, destY, destW, destH);

      // Silhouette lumineuse dorée/vanille lors des dégâts reçus
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(255, 238, 190, 0.92)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);

      return { normal: canvas, hurt: hurtCanvas };
    };

    const walk1Pair = processImage(images['walk1']);
    this.walk1Canvas = walk1Pair.normal;
    this.walk1HurtCanvas = walk1Pair.hurt;

    const walk2Pair = processImage(images['walk2']);
    this.walk2Canvas = walk2Pair.normal;
    this.walk2HurtCanvas = walk2Pair.hurt;

    const walk3Pair = processImage(images['walk3']);
    this.walk3Canvas = walk3Pair.normal;
    this.walk3HurtCanvas = walk3Pair.hurt;

    const slidePair = processImage(images['attack']);
    this.slideCanvas = slidePair.normal;
    this.slideHurtCanvas = slidePair.hurt;

    const meleePair = processImage(images['attack2']);
    this.meleeCanvas = meleePair.normal;
    this.meleeHurtCanvas = meleePair.hurt;

    // Pose de défaite : gâteau écrasé et émietté au sol avec glaçage étalé
    if (this.walk1Canvas) {
      const deadCanvas = document.createElement('canvas');
      deadCanvas.width = canvasSize;
      deadCanvas.height = canvasSize;
      const dCtx = deadCanvas.getContext('2d')!;
      const squashedH = Math.round(canvasSize * 0.24);
      const squashedY = canvasSize - squashedH;
      dCtx.drawImage(this.walk1Canvas, 0, squashedY, canvasSize, squashedH);
      dCtx.globalCompositeOperation = 'source-atop';
      dCtx.fillStyle = 'rgba(124, 45, 18, 0.65)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite adapté selon l'état et l'attaque du Roi Gâteau
   */
  public static getSprite(
    state: EnemyState,
    animTimer: number,
    isSliding: boolean,
    attackKind: CakeKingAttackKind,
    postAttackTimer: number,
    isMoving: boolean
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || !this.walk1Canvas) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.walk1Canvas;
    }

    // Phase de dégât reçu
    if (state === 'hurt') {
      if (isSliding) {
        return this.slideHurtCanvas ?? this.slideCanvas ?? this.walk1Canvas;
      }
      if (attackKind === 'melee' || postAttackTimer > 0) {
        return this.meleeHurtCanvas ?? this.meleeCanvas ?? this.walk1Canvas;
      }
      if (isMoving) {
        const hurtFrames = [
          this.walk1HurtCanvas ?? this.walk1Canvas,
          this.walk2HurtCanvas ?? this.walk2Canvas ?? this.walk1Canvas,
          this.walk3HurtCanvas ?? this.walk3Canvas ?? this.walk1Canvas,
        ];
        const index = Math.floor(animTimer * 5.5) % hurtFrames.length;
        return hurtFrames[index] ?? this.walk1Canvas;
      }
      return this.walk1HurtCanvas ?? this.walk1Canvas;
    }

    // 1. Attaque 1 : Glissade rapide vers le joueur
    if (isSliding) {
      return this.slideCanvas ?? this.walk1Canvas;
    }

    // 2. Attaque 2 : Coup de corps à corps (ou maintien de la frappe)
    if (
      (state === 'attacking' && attackKind === 'melee') ||
      (postAttackTimer > 0 && attackKind === 'melee')
    ) {
      return this.meleeCanvas ?? this.walk1Canvas;
    }

    // 3. Déplacement : cycle de marche à 3 frames
    if (isMoving) {
      const frames = [this.walk1Canvas, this.walk2Canvas ?? this.walk1Canvas, this.walk3Canvas ?? this.walk1Canvas];
      const index = Math.floor(animTimer * 5.5) % frames.length;
      return frames[index] ?? this.walk1Canvas;
    }

    // 4. Posture au repos : respiration légère entre walk1 et walk2
    const idleFrames = [this.walk1Canvas, this.walk2Canvas ?? this.walk1Canvas];
    const idleIndex = Math.floor(animTimer * 2.2) % idleFrames.length;
    return idleFrames[idleIndex] ?? this.walk1Canvas;
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(16, 16, 32, 40);
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(14, 20, 36, 10);
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
