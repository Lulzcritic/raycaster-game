import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

/**
 * Flaque de glaçage laissée au sol par le Carrot Cake King lors de sa glissade.
 * Ralentit considérablement tout joueur qui marche dessus.
 */
export class FrostingPuddle extends Entity {
  private static puddleFrames: HTMLCanvasElement[] | null = null;

  public readonly maxLifetime: number;
  public remainingLife: number;
  private readonly variant: number;

  constructor(x: number, y: number, lifetime = 8.5) {
    super(x, y, 0, 0.42);
    this.maxLifetime = lifetime;
    this.remainingLife = lifetime;
    this.variant = Math.floor(Math.random() * 3);
    FrostingPuddle.ensureSpritesCreated();
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return 0;
  }

  public override getScale(): number {
    // Rétractation progressive au cours des 1.2 dernières secondes
    if (this.remainingLife < 1.2) {
      return 0.45 * Math.max(0.2, this.remainingLife / 1.2);
    }
    return 0.45;
  }

  public override update(deltaTime: number, _map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.remainingLife -= deltaTime;
    if (this.remainingLife <= 0) {
      this.active = false;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!FrostingPuddle.puddleFrames) {
      return null;
    }
    return FrostingPuddle.puddleFrames[this.variant % FrostingPuddle.puddleFrames.length];
  }

  private static ensureSpritesCreated(): void {
    if (this.puddleFrames) {
      return;
    }

    this.puddleFrames = [
      this.createPuddleCanvas(48, 48, 0),
      this.createPuddleCanvas(48, 48, 1),
      this.createPuddleCanvas(48, 48, 2),
    ];
  }

  /**
   * Dessine une flaque de glaçage onctueuse vue en perspective plate au sol
   * avec coulis d'orange carotte, pépites et vermicelles de sucre colorés.
   */
  private static createPuddleCanvas(
    width: number,
    height: number,
    variant: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const centerX = width / 2;
    // Ancré vers le bas de la toile
    const centerY = height * 0.72;
    const radiusX = width * 0.44;
    const radiusY = height * 0.24;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x + 0.5 - centerX) / radiusX;
        const dy = (y + 0.5 - centerY) / radiusY;
        const normDist = Math.hypot(dx, dy);

        // Ondulations organiques sur le contour de la flaque
        const angle = Math.atan2(dy, dx);
        const bump =
          Math.sin(angle * 4 + variant * 2) * 0.08 +
          Math.cos(angle * 6 + variant) * 0.05;
        const effectiveDist = normDist + bump;

        if (effectiveDist > 1.0) {
          continue;
        }

        // 1. Dégradé de crème et glaçage royal
        if (effectiveDist > 0.88) {
          // Bordure translucide brillante
          ctx.fillStyle = '#fed7aa'; // Ambre clair fondant
        } else if (effectiveDist > 0.6) {
          ctx.fillStyle = '#fff7ed'; // Blanc crème vanille
        } else if (effectiveDist > 0.28) {
          ctx.fillStyle = '#ffffff'; // Cœur blanc éclatant sucré
        } else {
          // Reflet central
          ctx.fillStyle = '#ffedd5';
        }

        // 2. Coulées tourbillonnantes de caramel et jus de carotte
        const swirl = Math.sin(dx * 4 + dy * 3 + variant * 1.5);
        if (effectiveDist <= 0.8 && Math.abs(swirl) > 0.72) {
          ctx.fillStyle = swirl > 0 ? '#f97316' : '#ea580c';
        }

        ctx.fillRect(x, y, 1, 1);
      }
    }

    // 3. Vermicelles de sucre colorés (sprinkles) sur le glaçage
    const sprinkleColors = ['#ec4899', '#3b82f6', '#10b981', '#facc15', '#f97316'];
    const sprinkleCount = 12 + variant * 3;

    for (let i = 0; i < sprinkleCount; i++) {
      const angle = (i * 2.39 + variant * 1.1) % (Math.PI * 2);
      const r = (0.2 + ((i * 7) % 10) * 0.06);
      const px = Math.round(centerX + Math.cos(angle) * radiusX * r);
      const py = Math.round(centerY + Math.sin(angle) * radiusY * r);

      if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
        ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
        ctx.fillRect(px, py, 2, 1);
      }
    }

    return canvas;
  }
}
