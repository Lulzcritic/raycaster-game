const puzzleAttackUrl = new URL('../assets/sprites/player/puzzleLord/attack.png', import.meta.url).href;
const puzzleIdle1Url = new URL('../assets/sprites/player/puzzleLord/idle1.png', import.meta.url).href;
const puzzleIdle2Url = new URL('../assets/sprites/player/puzzleLord/idle2.png', import.meta.url).href;
const puzzleWalk1Url = new URL('../assets/sprites/player/puzzleLord/walk1.png', import.meta.url).href;
const puzzleWalk2Url = new URL('../assets/sprites/player/puzzleLord/walk2.png', import.meta.url).href;

const gouterAttackUrl = new URL('../assets/sprites/player/gouterLord/attack.png', import.meta.url).href;
const gouterIdleUrl = new URL('../assets/sprites/player/gouterLord/idle.png', import.meta.url).href;
const gouterWalk1Url = new URL('../assets/sprites/player/gouterLord/walk1.png', import.meta.url).href;
const gouterWalk2Url = new URL('../assets/sprites/player/gouterLord/walk2.png', import.meta.url).href;
const gouterWalk3Url = new URL('../assets/sprites/player/gouterLord/walk3.png', import.meta.url).href;
const gouterWalk4Url = new URL('../assets/sprites/player/gouterLord/walk4.png', import.meta.url).href;

export type PlayerVisualState = 'idle' | 'walk' | 'attack';

interface ProcessedFrameSet {
  idleFrames: HTMLCanvasElement[];
  idleHurtFrames: HTMLCanvasElement[];
  walkFrames: HTMLCanvasElement[];
  walkHurtFrames: HTMLCanvasElement[];
  attackFrame: HTMLCanvasElement;
  attackHurtFrame: HTMLCanvasElement;
}

/**
 * Gestionnaire de sprites et d'animations des avatars de joueurs (Lords).
 * Normalise les frames sur des toiles 256x256 avec ancrage parfait au sol,
 * silhouettes de dégâts (flash rouge/blanc) et interpolation d'animation.
 */
export class PlayerSpriteManager {
  private static readonly skinSets = new Map<string, ProcessedFrameSet>();
  private static fallbackCanvas: HTMLCanvasElement | null = null;
  private static isInitialized = false;

  public static async preloadAll(): Promise<void> {
    if (this.isInitialized || typeof document === 'undefined') {
      return;
    }

    const loadImg = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.error(`[PlayerSpriteManager] Erreur chargement sprite: ${url}`);
          resolve(img);
        };
        img.src = url;
      });

    const [
      pAttack,
      pIdle1,
      pIdle2,
      pWalk1,
      pWalk2,
      gAttack,
      gIdle,
      gWalk1,
      gWalk2,
      gWalk3,
      gWalk4,
    ] = await Promise.all([
      loadImg(puzzleAttackUrl),
      loadImg(puzzleIdle1Url),
      loadImg(puzzleIdle2Url),
      loadImg(puzzleWalk1Url),
      loadImg(puzzleWalk2Url),
      loadImg(gouterAttackUrl),
      loadImg(gouterIdleUrl),
      loadImg(gouterWalk1Url),
      loadImg(gouterWalk2Url),
      loadImg(gouterWalk3Url),
      loadImg(gouterWalk4Url),
    ]);

    const canvasSize = 256;
    const availableSize = 236;

    const buildFrameSet = (
      idles: HTMLImageElement[],
      walks: HTMLImageElement[],
      attack: HTMLImageElement
    ): ProcessedFrameSet => {
      const allImages = [...idles, ...walks, attack].filter((img) => img.width > 0 && img.height > 0);
      let maxW = 1;
      let maxH = 1;
      for (const img of allImages) {
        if (img.width > maxW) maxW = img.width;
        if (img.height > maxH) maxH = img.height;
      }

      const uniformScale = Math.min(availableSize / maxW, availableSize / maxH);

      const process = (img: HTMLImageElement): { normal: HTMLCanvasElement; hurt: HTMLCanvasElement } => {
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;

        const destW = Math.round(img.width * uniformScale);
        const destH = Math.round(img.height * uniformScale);
        const destX = Math.round((canvasSize - destW) / 2);
        const destY = canvasSize - destH; // Ancré au bas (sol)

        ctx.drawImage(img, destX, destY, destW, destH);

        const hurtCanvas = document.createElement('canvas');
        hurtCanvas.width = canvasSize;
        hurtCanvas.height = canvasSize;
        const hCtx = hurtCanvas.getContext('2d')!;
        hCtx.drawImage(canvas, 0, 0);
        hCtx.globalCompositeOperation = 'source-atop';
        hCtx.fillStyle = 'rgba(255, 75, 75, 0.85)';
        hCtx.fillRect(0, 0, canvasSize, canvasSize);

        return { normal: canvas, hurt: hurtCanvas };
      };

      const idlePairs = idles.map(process);
      const walkPairs = walks.map(process);
      const attackPair = process(attack);

      return {
        idleFrames: idlePairs.map((p) => p.normal),
        idleHurtFrames: idlePairs.map((p) => p.hurt),
        walkFrames: walkPairs.map((p) => p.normal),
        walkHurtFrames: walkPairs.map((p) => p.hurt),
        attackFrame: attackPair.normal,
        attackHurtFrame: attackPair.hurt,
      };
    };

    // 1. Lord Énigmatique (puzzle_lord)
    const puzzleSet = buildFrameSet(
      [pIdle1, pIdle2],
      [pWalk1, pWalk2],
      pAttack
    );
    this.skinSets.set('puzzle_lord', puzzleSet);

    // 2. Lord Gourmand (gouter_lord)
    const gouterSet = buildFrameSet(
      [gIdle],
      [gWalk1, gWalk2, gWalk3, gWalk4],
      gAttack
    );
    this.skinSets.set('gouter_lord', gouterSet);

    this.isInitialized = true;
  }

  public static getSprite(
    skinId: string,
    state: PlayerVisualState,
    animTimer: number,
    isHurt = false
  ): HTMLCanvasElement | null {
    const set = this.skinSets.get(skinId) ?? this.skinSets.get('puzzle_lord');
    if (!set) {
      return this.getFallbackCanvas();
    }

    if (state === 'attack') {
      return isHurt ? set.attackHurtFrame : set.attackFrame;
    }

    if (state === 'walk') {
      const frames = isHurt ? set.walkHurtFrames : set.walkFrames;
      if (frames.length === 0) return set.attackFrame;
      const idx = Math.floor(animTimer * 5.0) % frames.length;
      return frames[idx] ?? frames[0]!;
    }

    // state === 'idle'
    const frames = isHurt ? set.idleHurtFrames : set.idleFrames;
    if (frames.length === 0) return set.attackFrame;
    const idx = Math.floor(animTimer * 2.0) % frames.length;
    return frames[idx] ?? frames[0]!;
  }

  private static getFallbackCanvas(): HTMLCanvasElement {
    if (this.fallbackCanvas) {
      return this.fallbackCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(20, 14, 24, 38);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(28, 22, 8, 4);
    this.fallbackCanvas = canvas;
    return canvas;
  }
}
