import type { Player } from '../entities/Player';
import type { RayHit, Side } from '../types';
import type { GameMap } from '../world/GameMap';

export class Raycaster {
  /**
   * Lance un rayon unique selon l'algorithme DDA (Digital Differential Analyzer)
   */
  public castRay(player: Player, map: GameMap, rayAngle: number): RayHit {
    // On convertit cet angle en coordonnées cartésiennes pour avoir le vecteur (dx, dy) du rayon
    const vectorX = Math.cos(rayAngle);
    const vectorY = Math.sin(rayAngle);

    // On calcule la distance du rayon d'une intersection de grille à la suivante
    const deltaX = Math.abs(1 / vectorX);
    const deltaY = Math.abs(1 / vectorY);

    // Case courante du joueur
    let caseX = Math.floor(player.x);
    let caseY = Math.floor(player.y);

    let toNextCellX = 0;
    let stepX = 0;

    if (vectorX > 0) {
      toNextCellX = caseX + 1 - player.x;
      stepX = 1;
    } else {
      toNextCellX = player.x - caseX;
      stepX = -1;
    }

    let sideDistX = toNextCellX * deltaX;

    let toNextCellY = 0;
    let stepY = 0;

    if (vectorY > 0) {
      toNextCellY = caseY + 1 - player.y;
      stepY = 1;
    } else {
      toNextCellY = player.y - caseY;
      stepY = -1;
    }

    let sideDistY = toNextCellY * deltaY;

    // Est-ce qu'on coupe une ligne horizontale ou verticale ?
    let hit = false;
    let side: Side = 0;
    let tileId = 0;

    while (!hit) {
      if (sideDistX < sideDistY) {
        // On coupe une ligne verticale
        caseX += stepX;
        sideDistX += deltaX;
        side = 0;
      } else {
        // On coupe une ligne horizontale
        caseY += stepY;
        sideDistY += deltaY;
        side = 1;
      }

      // Si on est hors de la map on s'arrête
      if (map.isOutOfBounds(caseX, caseY)) {
        break;
      }

      if (map.isWall(caseX, caseY)) {
        // La case est un mur
        hit = true;
        tileId = map.getTile(caseX, caseY);
      }
    }

    const distance = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;

    // Coordonnée normalisée [0, 1[ de l'impact sur le mur pour le mapping de texture
    let wallX =
      side === 0
        ? player.y + distance * vectorY
        : player.x + distance * vectorX;
    wallX -= Math.floor(wallX);

    return {
      hit,
      distance,
      side,
      mapX: caseX,
      mapY: caseY,
      rayAngle,
      tileId,
      wallX,
      vectorX,
      vectorY,
    };
  }
}
