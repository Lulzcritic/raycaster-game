export type PropKind = 'pillar' | 'barrel' | 'box' | 'table';

const barrelUrl = new URL('../assets/sprites/props/barrel.png', import.meta.url).href;
const boxUrl = new URL('../assets/sprites/props/box.png', import.meta.url).href;
const pillarUrl = new URL('../assets/sprites/props/pillar.png', import.meta.url).href;
const tableUrl = new URL('../assets/sprites/props/table.png', import.meta.url).href;

/**
 * Gestionnaire de sprites pour les éléments de décor interactifs et solides (props) :
 * - Tonneau (barrel) : obstacle sporadiquement placé
 * - Caisse (box) : encombrement de crypte
 * - Table (table) : mobilier médiéval
 * - Pilier (pillar) : haute colonne de sanctuaire, abri tactique et surface de ricochet
 */
export class PropSpriteManager {
  private static readonly sprites = new Map<PropKind, HTMLCanvasElement>();
  private static isInitialized = false;

  public static async preloadAll(): Promise<void> {
    if (this.isInitialized || typeof document === 'undefined') {
      return;
    }

    const entries: Array<{ kind: PropKind; url: string }> = [
      { kind: 'pillar', url: pillarUrl },
      { kind: 'barrel', url: barrelUrl },
      { kind: 'box', url: boxUrl },
      { kind: 'table', url: tableUrl },
    ];

    await Promise.all(
      entries.map(
        ({ kind, url }) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d')!;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0);
              this.sprites.set(kind, canvas);
              resolve();
            };
            img.onerror = () => {
              console.error(`Impossible de charger le sprite de prop (${kind}) : ${url}`);
              resolve();
            };
            img.src = url;
          })
      )
    );

    this.isInitialized = true;
  }

  public static getSprite(kind: PropKind): HTMLCanvasElement | null {
    const sprite = this.sprites.get(kind);
    if (sprite) {
      return sprite;
    }
    return this.createFallbackCanvas(kind);
  }

  private static createFallbackCanvas(kind: PropKind): HTMLCanvasElement | null {
    if (typeof document === 'undefined') {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'pillar' ? 64 : 64;
    canvas.height = kind === 'pillar' ? 128 : 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = kind === 'pillar' ? '#696969' : '#8B5A2B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
}
