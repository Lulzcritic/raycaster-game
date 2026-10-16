import { TEXTURE_DEFINITIONS, TILE_TYPE } from '../config/constants';

export { TILE_TYPE };

export class GameMap {
  private readonly grid: number[][];
  private readonly floorGrid?: number[][];
  private readonly wallTileIds: ReadonlySet<number>;
  private readonly floorTileIds: ReadonlySet<number>;
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

  public isWalkable(x: number, y: number): boolean {
    return !this.isOutOfBounds(x, y) && !this.isWall(x, y);
  }
}
