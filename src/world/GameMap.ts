import { TEXTURE_DEFINITIONS, TILE_TYPE } from '../config/constants';

export { TILE_TYPE };

/**
 * Interface pour tout obstacle physique ou visuel situé sur la carte :
 * piliers, tonneaux, caisses, tables, etc.
 */
export interface MapObstacle {
  x: number;
  y: number;
  radius: number;
  isSolid: boolean;
  blocksSight: boolean;
  bouncesProjectiles: boolean;
}

export class GameMap {
  private readonly grid: number[][];
  private readonly floorGrid?: number[][];
  private readonly wallTileIds: ReadonlySet<number>;
  private readonly floorTileIds: ReadonlySet<number>;
  private readonly obstacles: MapObstacle[] = [];
  public readonly skyTileId: number;
  public readonly height: number;
  public readonly width: number;

  constructor(
    grid: number[][],
    floorGrid?: number[][],
    skyTileId: number = TILE_TYPE.SKY_1
  ) {
    this.grid = grid;
    this.floorGrid = floorGrid;
    this.skyTileId = skyTileId;
    this.height = grid.length;
    this.width = grid[0]?.length ?? 0;

    this.wallTileIds = new Set(
      TEXTURE_DEFINITIONS.filter((tex) => tex.category === 'wall').map((tex) => tex.id)
    );

    this.floorTileIds = new Set(
      TEXTURE_DEFINITIONS.filter((tex) => tex.category === 'floor').map((tex) => tex.id)
    );
  }

  public addObstacle(obstacle: MapObstacle): void {
    this.obstacles.push(obstacle);
  }

  public clearObstacles(): void {
    this.obstacles.length = 0;
  }

  public getObstacles(): readonly MapObstacle[] {
    return this.obstacles;
  }

  public isOutOfBounds(x: number, y: number): boolean {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    return cellX < 0 || cellY < 0 || cellX >= this.width || cellY >= this.height;
  }

  public getTile(x: number, y: number): number {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    if (this.isOutOfBounds(cellX, cellY)) {
      return TILE_TYPE.WALL_1;
    }
    return this.grid[cellY][cellX];
  }

  public setTile(x: number, y: number, tileId: number): void {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    if (!this.isOutOfBounds(cellX, cellY)) {
      this.grid[cellY][cellX] = tileId;
    }
  }

  public getFloorTile(x: number, y: number): number {
    if (this.isOutOfBounds(x, y)) {
      return TILE_TYPE.GROUND_1;
    }

    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    if (this.floorGrid) {
      return this.floorGrid[cellY]?.[cellX] ?? TILE_TYPE.GROUND_1;
    }

    const tileId = this.grid[cellY][cellX];
    // Si la case est une texture de sol explicite, on l'utilise ; sinon (mur ou sprite posé au sol) on affiche GROUND_1
    return this.floorTileIds.has(tileId) ? tileId : TILE_TYPE.GROUND_1;
  }

  public isWall(x: number, y: number): boolean {
    if (this.isOutOfBounds(x, y)) {
      return false;
    }
    const tileId = this.grid[Math.floor(y)][Math.floor(x)];
    return this.wallTileIds.has(tileId);
  }

  /**
   * Vérifie si une position ponctuelle est accessible (ni mur ni obstacle solide)
   */
  public isWalkable(x: number, y: number, radius = 0): boolean {
    if (this.isOutOfBounds(x, y) || this.isWall(x, y)) {
      return false;
    }
    return !this.isBlockedByObstacle(x, y, radius);
  }

  /**
   * Vérifie si un cercle (x, y, radius) chevauche un obstacle solide
   */
  public isBlockedByObstacle(x: number, y: number, radius = 0): boolean {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (!obs.isSolid) {
        continue;
      }
      const dx = x - obs.x;
      const dy = y - obs.y;
      const minDist = obs.radius + radius;
      if (dx * dx + dy * dy < minDist * minDist) {
        return true;
      }
    }
    return false;
  }

  /**
   * Renvoie le premier obstacle solide touché au point (x, y) avec marge radius
   */
  public getSolidObstacleAt(x: number, y: number, radius = 0): MapObstacle | null {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (!obs.isSolid) {
        continue;
      }
      const dx = x - obs.x;
      const dy = y - obs.y;
      const minDist = obs.radius + radius;
      if (dx * dx + dy * dy < minDist * minDist) {
        return obs;
      }
    }
    return null;
  }

  /**
   * Renvoie un obstacle réflecteur (pilier) touché au point (x, y) pour le ricochet
   */
  public getBouncingObstacleAt(x: number, y: number, radius = 0): MapObstacle | null {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (!obs.bouncesProjectiles) {
        continue;
      }
      const dx = x - obs.x;
      const dy = y - obs.y;
      const minDist = obs.radius + radius;
      if (dx * dx + dy * dy < minDist * minDist) {
        return obs;
      }
    }
    return null;
  }

  /**
   * Teste si une entité de taille hitbox peut se déplacer à la position cible (murs + obstacles)
   */
  public canMove(targetX: number, targetY: number, hitBox = 0.25): boolean {
    if (this.isOutOfBounds(targetX, targetY)) {
      return false;
    }

    // Vérifie les 4 coins de la boîte de collision contre les murs
    if (
      this.isWall(targetX - hitBox, targetY - hitBox) ||
      this.isWall(targetX + hitBox, targetY - hitBox) ||
      this.isWall(targetX - hitBox, targetY + hitBox) ||
      this.isWall(targetX + hitBox, targetY + hitBox)
    ) {
      return false;
    }

    // Vérifie l'intersection circulaire avec tous les obstacles solides
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (!obs.isSolid) {
        continue;
      }
      const dx = targetX - obs.x;
      const dy = targetY - obs.y;
      const minDist = obs.radius + hitBox;
      if (dx * dx + dy * dy < minDist * minDist) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie la ligne de vue directe entre deux points :
   * - Bloquée par les murs de la carte
   * - Bloquée par les obstacles opaques (comme les hauts piliers de pierre)
   * Permet au joueur de se dissimuler derrière les piliers pour briser l'aggro ou esquiver les tirs.
   */
  public hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 0.1) {
      return true;
    }

    // 1. Ray marching le long du vecteur contre les murs solides
    const steps = Math.ceil(dist / 0.2);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i < steps; i++) {
      if (this.isWall(x1 + stepX * i, y1 + stepY * i)) {
        return false;
      }
    }

    // 2. Test géométrique analytique contre les obstacles occultant la vue (piliers)
    for (let j = 0; j < this.obstacles.length; j++) {
      const obs = this.obstacles[j];
      if (!obs.blocksSight) {
        continue;
      }

      // Projection orthogonale du centre du pilier sur le segment [P1, P2]
      const t = Math.max(0, Math.min(1, ((obs.x - x1) * dx + (obs.y - y1) * dy) / distSq));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dSq = (obs.x - projX) ** 2 + (obs.y - projY) ** 2;

      // Si le rayon traverse le volume du pilier
      if (dSq < (obs.radius * 0.95) ** 2) {
        return false;
      }
    }

    return true;
  }
}
