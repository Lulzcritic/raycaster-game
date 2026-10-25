import attackUrl from '../assets/sprites/ennemies/bloodQueen/attack.png';
import attack2Url from '../assets/sprites/ennemies/bloodQueen/attack2.png';
import idleUrl from '../assets/sprites/ennemies/bloodQueen/idle.png';
import loadAttackUrl from '../assets/sprites/ennemies/bloodQueen/loadAttack.png';
import type { EnemyState } from '../entities/Enemy';

export type BloodQueenAttackKind = 'normal' | 'wave_charge' | 'wave_release';

/**
 * Gestionnaire d'animation et de rendu de la Reine de Sang (Blood Queen),
 * Boss final de la Zone 3.
 * Normalise les 4 poses haute définition (idle, attack, loadAttack, attack2)
 * sur une toile 256x256 avec ancrage au sol, silhouette de dégât et flaques d'effondrement.
 */
export class BloodQueenSpriteManager {
  private static idleCanvas: HTMLCanvasElement | null = null;
  private static idleHurtCanvas: HTMLCanvasElement | null = null;

  private static attackCanvas: HTMLCanvasElement | null = null;
  private static attackHurtCanvas: HTMLCanvasElement | null = null;

  private static loadAttackCanvas: HTMLCanvasElement | null = null;
  private static loadAttackHurtCanvas: HTMLCanvasElement | null = null;

  private static attack2Canvas: HTMLCanvasElement | null = null;
  private static attack2HurtCanvas: HTMLCanvasElement | null = null;

  private static deadFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge les 4 toiles d'animation de la Reine de Sang
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spriteEntries = [
      { key: 'idle', url: idleUrl },
      { key: 'attack', url: attackUrl },
      { key: 'loadAttack', url: loadAttackUrl },
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
              console.error(`Impossible de charger le sprite de la Blood Queen (${key}) : ${url}`);
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
      const destY = canvasSize - destH; // Ancré fermement au bas de la toile (sol)

      ctx.drawImage(img, destX, destY, destW, destH);

      // Silhouette spectrale cramoisie et blanche éclatante lors des coups subis
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(255, 220, 235, 0.92)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);

      return { normal: canvas, hurt: hurtCanvas };
    };

    const idlePair = processImage(images['idle']);
    this.idleCanvas = idlePair.normal;
    this.idleHurtCanvas = idlePair.hurt;

    const attackPair = processImage(images['attack']);
    this.attackCanvas = attackPair.normal;
    this.attackHurtCanvas = attackPair.hurt;

    const loadPair = processImage(images['loadAttack']);
    this.loadAttackCanvas = loadPair.normal;
    this.loadAttackHurtCanvas = loadPair.hurt;

    const attack2Pair = processImage(images['attack2']);
    this.attack2Canvas = attack2Pair.normal;
    this.attack2HurtCanvas = attack2Pair.hurt;

    // Pose de mort : flaque de sang sombre et voiles effondrés
    if (this.idleCanvas) {
      const deadCanvas = document.createElement('canvas');
      deadCanvas.width = canvasSize;
      deadCanvas.height = canvasSize;
      const dCtx = deadCanvas.getContext('2d')!;
      const squashedH = Math.round(canvasSize * 0.22);
      const squashedY = canvasSize - squashedH;
      dCtx.drawImage(this.idleCanvas, 0, squashedY, canvasSize, squashedH);
      dCtx.globalCompositeOperation = 'source-atop';
      dCtx.fillStyle = 'rgba(76, 5, 25, 0.7)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite adapté à la phase de combat de la Reine de Sang
   */
  public static getSprite(
    state: EnemyState,
    _animTimer: number,
    attackKind: BloodQueenAttackKind,
    postAttackTimer: number
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || !this.idleCanvas) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.idleCanvas;
    }

    // Phase de dégât reçu (flash blanc/rose)
    if (state === 'hurt') {
      if (attackKind === 'wave_charge') {
        return this.loadAttackHurtCanvas ?? this.loadAttackCanvas ?? this.idleCanvas;
      }
      if (attackKind === 'wave_release') {
        return this.attack2HurtCanvas ?? this.attack2Canvas ?? this.idleCanvas;
      }
      if (postAttackTimer > 0) {
        return this.attackHurtCanvas ?? this.attackCanvas ?? this.idleCanvas;
      }
      return this.idleHurtCanvas ?? this.idleCanvas;
    }

    // 1. Canalisation de l'Onde de Sang (Attaque 2 en charge)
    if (attackKind === 'wave_charge') {
      return this.loadAttackCanvas ?? this.idleCanvas;
    }

    // 2. Déclenchement de l'Onde de Sang (libération)
    if (attackKind === 'wave_release') {
      return this.attack2Canvas ?? this.idleCanvas;
    }

    // 3. Tir d'orbe de sang individuel (Attaque 1 normale)
    if (state === 'attacking' || postAttackTimer > 0) {
      return this.attackCanvas ?? this.idleCanvas;
    }

    // 4. Posture de base royale (flottement au-dessus du sol)
    return this.idleCanvas;
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(20, 10, 24, 44);
    ctx.fillStyle = '#ffe4e6';
    ctx.fillRect(26, 18, 4, 4);
    ctx.fillRect(34, 18, 4, 4);
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
