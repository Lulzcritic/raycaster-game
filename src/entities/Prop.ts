import { TILE_TYPE } from '../config/constants';
import { PropSpriteManager, type PropKind } from '../graphics/PropSpriteManager';
import type { GameMap, MapObstacle } from '../world/GameMap';
import { Entity } from './Entity';

/**
 * Entité représentant un objet du décor physique (prop) :
 * - 'pillar' : Pilier de pierre massif s'élevant jusqu'au plafond (scale 1.0),
 *              bloque la ligne de vue (permet de se cacher des ennemis)
 *              et offre une surface de rebond physique pour les projectiles magiques (PurpleOrb).
 * - 'barrel' : Tonneau de bois posé au sol (scale 0.44), obstacle solide.
 * - 'box'    : Caisse en bois (scale 0.42), obstacle solide.
 * - 'table'  : Table médiévale (scale 0.42), obstacle solide.
 */
export class Prop extends Entity implements MapObstacle {
  public readonly propType: PropKind;
  public readonly textureId: number;
  public readonly radius: number;
  public readonly isSolid: boolean;
  public readonly blocksSight: boolean;
  public readonly bouncesProjectiles: boolean;
  private readonly scale: number;

  constructor(x: number, y: number, propType: PropKind, customScale?: number) {
    let defaultScale = 0.42;
    let radius = 0.28;
    let blocksSight = false;
    let bounces = false;
    let textureId: number = TILE_TYPE.BOX;

    switch (propType) {
      case 'pillar':
        defaultScale = 1.0;
        radius = 0.35;
        blocksSight = true;
        bounces = true;
        textureId = TILE_TYPE.PILLAR;
        break;
      case 'barrel':
        defaultScale = 0.44;
        radius = 0.28;
        textureId = TILE_TYPE.BARREL;
        break;
      case 'table':
        defaultScale = 0.42;
        radius = 0.32;
        textureId = TILE_TYPE.TABLE;
        break;
      case 'box':
      default:
        defaultScale = 0.42;
        radius = 0.28;
        textureId = TILE_TYPE.BOX;
        break;
    }

    super(x, y, 0, radius);
    this.propType = propType;
    this.scale = customScale ?? defaultScale;
    this.radius = radius;
    this.isSolid = true;
    this.blocksSight = blocksSight;
    this.bouncesProjectiles = bounces;
    this.textureId = textureId;
  }

  public override getSprite(): HTMLCanvasElement | null {
    return PropSpriteManager.getSprite(this.propType);
  }

  public override getScale(): number {
    return this.scale;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return 0;
  }

  public update(_deltaTime: number, _map: GameMap): void {
    // Les éléments de décor sont statiques
  }
}
