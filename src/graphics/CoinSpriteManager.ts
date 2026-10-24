import coinUrl from '../assets/textures/coin.png';

/**
 * Gestionnaire de sprite pour les pièces d'or.
 * Précharge la texture et produit le canevas 3D avec halo lumineux circulaire au sol.
 */
export class CoinSpriteManager {
  private static worldCanvas: HTMLCanvasElement | null = null;
  private static coinImage: HTMLImageElement | null = null;
  private static isLoaded = false;

  public static getCoinUrl(): string {
    return coinUrl;
  }

  public static async preloadAll(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.coinImage = img;
        this.createWorldCanvas(img);
        this.isLoaded = true;
        resolve();
      };
      img.onerror = () => {
        console.error('Impossible de charger la texture de la pièce :', coinUrl);
        resolve();
      };
      img.src = coinUrl;
    });
  }

  private static createWorldCanvas(img: HTMLImageElement): void {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;

    const padBottom = 8;
    const groundY = size - padBottom;

    // 1. Halo lumineux doré au sol sous la pièce
    const auraGradient = ctx.createRadialGradient(
      size / 2,
      groundY,
      2,
      size / 2,
      groundY,
      36
    );
    auraGradient.addColorStop(0, 'rgba(250, 204, 21, 0.75)');
    auraGradient.addColorStop(0.4, 'rgba(234, 179, 8, 0.35)');
    auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.scale(1, 0.38);
    ctx.beginPath();
    ctx.arc(size / 2, groundY / 0.38, 36, 0, Math.PI * 2);
    ctx.fillStyle = auraGradient;
    ctx.fill();
    ctx.restore();

    // 2. Dessin de la pièce d'or centrée au-dessus de l'aura
    const targetCoinSize = 96;
    const scale = Math.min(
      targetCoinSize / img.naturalWidth,
      targetCoinSize / img.naturalHeight
    );
    const drawW = Math.round(img.naturalWidth * scale);
    const drawH = Math.round(img.naturalHeight * scale);
    const drawX = Math.round((size - drawW) / 2);
    const drawY = Math.round(size - padBottom - drawH);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    this.worldCanvas = canvas;
  }

  public static getCoinWorldCanvas(): HTMLCanvasElement {
    if (this.worldCanvas) {
      return this.worldCanvas;
    }
    if (this.coinImage && this.coinImage.complete) {
      this.createWorldCanvas(this.coinImage);
      if (this.worldCanvas) {
        return this.worldCanvas;
      }
    }
    return this.createFallbackCanvas();
  }

  private static createFallbackCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#713f12';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('$', 26, 38);
    return canvas;
  }
}
