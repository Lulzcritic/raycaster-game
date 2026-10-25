import attack1Url from '../assets/sprites/ennemies/skeleton/attack1.png';
import attack2Url from '../assets/sprites/ennemies/skeleton/attack2.png';
import attack3Url from '../assets/sprites/ennemies/skeleton/attack3.png';
import walk1Url from '../assets/sprites/ennemies/skeleton/walk1.png';
import walk2Url from '../assets/sprites/ennemies/skeleton/walk2.png';
import type { EnemyState } from '../entities/Enemy';

/**
 * Gestionnaire d'animation et de rendu du Squelette Archer.
 * Normalise les sprites d'archerie et de déplacement (walk1, walk2, attack1, attack2, attack3)
 * sur une toile 256x256 avec ancrage parfait au sol, silhouettes spectrales de dégât et pose de mort.
 */
export class SkeletonSpriteManager {
  private static readonly walkFrames: HTMLCanvasElement[] = [];
  private static readonly walkHurtFrames: HTMLCanvasElement[] = [];

  private static readonly attackFrames: HTMLCanvasElement[] = [];
  private static readonly attackHurtFrames: HTMLCanvasElement[] = [];

  private static deadFrame: HTMLCanvasElement | null = null;
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  /**
   * Précharge l'intégralité des sprites du squelette archer et assemble les toiles de rendu
   */
  public static async preloadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const walkUrls = [walk1Url, walk2Url];
    const attackUrls = [attack1Url, attack2Url, attack3Url];

    const loadImages = async (urls: string[]): Promise<HTMLImageElement[]> => {
      const results: HTMLImageElement[] = new Array(urls.length);
      await Promise.all(
        urls.map(
          (url, idx) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                results[idx] = img;
                resolve();
              };
              img.onerror = () => {
                console.error(`Impossible de charger le sprite du squelette : ${url}`);
                resolve();
              };
              img.src = url;
            })
        )
      );
      return results;
    };

    const [walkImages, attackImages] = await Promise.all([
      loadImages(walkUrls),
      loadImages(attackUrls),
    ]);

    const allImages = [...walkImages, ...attackImages].filter(Boolean);
    let maxW = 1;
    let maxH = 1;

    for (const img of allImages) {
      if (img.width > maxW) maxW = img.width;
      if (img.height > maxH) maxH = img.height;
    }

    const canvasSize = 256;
    // Échelle uniforme pour préserver les proportions exactes entre chaque pose du squelette
    const availableSize = 236;
    const uniformScale = Math.min(availableSize / maxW, availableSize / maxH);

    const processImage = (
      img: HTMLImageElement
    ): { normal: HTMLCanvasElement; hurt: HTMLCanvasElement } => {
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

      // Silhouette spectrale / ossement blanc bleuté pour le retour de coup
      const hurtCanvas = document.createElement('canvas');
      hurtCanvas.width = canvasSize;
      hurtCanvas.height = canvasSize;
      const hCtx = hurtCanvas.getContext('2d')!;
      hCtx.drawImage(canvas, 0, 0);
      hCtx.globalCompositeOperation = 'source-atop';
      hCtx.fillStyle = 'rgba(235, 245, 255, 0.9)';
      hCtx.fillRect(0, 0, canvasSize, canvasSize);

      return { normal: canvas, hurt: hurtCanvas };
    };

    // Traitement des frames de marche
    for (const img of walkImages) {
      if (!img) continue;
      const { normal, hurt } = processImage(img);
      this.walkFrames.push(normal);
      this.walkHurtFrames.push(hurt);
    }

    // Traitement des frames d'attaque
    for (const img of attackImages) {
      if (!img) continue;
      const { normal, hurt } = processImage(img);
      this.attackFrames.push(normal);
      this.attackHurtFrames.push(hurt);
    }

    // Frame d'élimination : squelette effondré en tas d'ossements au sol
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
      dCtx.fillStyle = 'rgba(20, 25, 35, 0.45)';
      dCtx.fillRect(0, 0, canvasSize, canvasSize);
      this.deadFrame = deadCanvas;
    }

    this.isInitialized = true;
  }

  /**
   * Retourne le sprite adapté à la phase d'animation du squelette archer
   * @param state État de l'ennemi (idle, aggro, attacking, hurt, dead)
   * @param animTimer Timer d'animation globale
   * @param stateTimer Timer de l'état actuel (notamment le compte à rebours du windup)
   * @param totalWindup Durée totale de préparation du tir
   * @param postAttackTimer Timer maintenant la pose de décoche (attack3) après le tir
   * @param isMoving Indique si le squelette est en train de marcher
   */
  public static getSprite(
    state: EnemyState,
    animTimer: number,
    stateTimer: number,
    totalWindup: number,
    postAttackTimer: number,
    isMoving: boolean
  ): HTMLCanvasElement | null {
    if (!this.isInitialized || this.walkFrames.length === 0) {
      return this.getFallbackCanvas();
    }

    if (state === 'dead') {
      return this.deadFrame ?? this.walkFrames[0] ?? null;
    }

    if (state === 'hurt') {
      if (postAttackTimer > 0) {
        return this.attackHurtFrames[2] ?? this.attackFrames[2] ?? this.walkFrames[0]!;
      }
      const walkIdx = isMoving ? Math.floor(animTimer * 4.2) % this.walkHurtFrames.length : 0;
      return this.walkHurtFrames[walkIdx] ?? this.walkFrames[0]!;
    }

    // 1. Phase de tir active (bander l'arc ou décoche)
    if (state === 'attacking') {
      const windup = totalWindup > 0 ? totalWindup : 0.65;
      const progress = 1 - Math.max(0, stateTimer) / windup;

      // Frame 0 (attack1) : saisie de la flèche et mise en tension initiale
      // Frame 1 (attack2) : pleine tension, visée précise, yeux luisants
      const attackFrameIdx = progress < 0.45 ? 0 : 1;
      return this.attackFrames[attackFrameIdx] ?? this.walkFrames[0]!;
    }

    // 2. Post-décoche : maintient la posture de recul (attack3) pendant ~0.25s
    if (postAttackTimer > 0) {
      return this.attackFrames[2] ?? this.walkFrames[0]!;
    }

    // 3. Déplacement ou repos (walk1 <-> walk2)
    const walkIdx = isMoving ? Math.floor(animTimer * 4.2) % this.walkFrames.length : 0;
    return this.walkFrames[walkIdx] ?? this.walkFrames[0]!;
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(24, 16, 16, 32);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, 20, 3, 3); // œil bleu spectral
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
