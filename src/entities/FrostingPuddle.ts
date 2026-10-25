import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

/**
 * Flaque / traînée de glaçage laissée au sol par le Carrot Cake King lors de sa glissade.
 * N'est PAS un sprite vertical debout, mais une décalcomanie appliquée à plat par-dessus
 * la texture du sol dans le raycaster.
 * Ralentit considérablement tout joueur qui marche dessus.
 */
export class FrostingPuddle extends Entity {
  public readonly radius = 0.44;
  public readonly radiusSq = 0.44 * 0.44;
  public readonly maxLifetime: number;
  public remainingLife: number;
  public readonly variant: number;

  constructor(x: number, y: number, lifetime = 8.5) {
    super(x, y, 0, 0.44);
    this.maxLifetime = lifetime;
    this.remainingLife = lifetime;
    this.variant = Math.floor(Math.random() * 3);
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return 0;
  }

  /**
   * Retourne null pour ne jamais être dessiné comme un billboard vertical dans l'espace 3D.
   * Le rendu est directement appliqué à plat sur la texture du sol par le Renderer.
   */
  public override getSprite(): HTMLCanvasElement | null {
    return null;
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
}
