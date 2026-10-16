import type { Vector2D } from '../types';
import type { GameMap } from '../world/GameMap';

function isValidDropPoint(
  x: number,
  y: number,
  map: GameMap,
  existing: readonly Vector2D[],
  minDist = 0.65
): boolean {
  const margin = 0.2;
  if (
    !map.isWalkable(x, y) ||
    !map.isWalkable(x - margin, y) ||
    !map.isWalkable(x + margin, y) ||
    !map.isWalkable(x, y - margin) ||
    !map.isWalkable(x, y + margin)
  ) {
    return false;
  }

  for (const pt of existing) {
    if (Math.hypot(pt.x - x, pt.y - y) < minDist) {
      return false;
    }
  }

  return true;
}

/**
 * Détermine des positions au sol autour du coffre garantissant que les fiches billboard ne se chevauchent pas
 */
export function findSpacedDropPositions(
  chestX: number,
  chestY: number,
  playerX: number,
  playerY: number,
  count: number,
  map: GameMap
): Vector2D[] {
  if (count <= 0) {
    return [];
  }

  const results: Vector2D[] = [];
  const baseAngle = Math.atan2(playerY - chestY, playerX - chestX);

  // Configuration idéale d'angles et de rayons en éventail face au joueur
  const plannedOffsets: Array<{ angleOffset: number; radius: number }> = [];

  if (count === 1) {
    plannedOffsets.push({ angleOffset: 0, radius: 0.85 });
  } else if (count === 2) {
    plannedOffsets.push({ angleOffset: -0.65, radius: 0.85 });
    plannedOffsets.push({ angleOffset: 0.65, radius: 0.85 });
  } else if (count === 3) {
    plannedOffsets.push({ angleOffset: -0.75, radius: 0.8 });
    plannedOffsets.push({ angleOffset: 0, radius: 1.05 });
    plannedOffsets.push({ angleOffset: 0.75, radius: 0.8 });
  } else {
    const step = 1.8 / (count - 1);
    for (let i = 0; i < count; i++) {
      const angleOffset = -0.9 + i * step;
      const radius = i % 2 === 0 ? 0.8 : 1.05;
      plannedOffsets.push({ angleOffset, radius });
    }
  }

  // 1. Essai avec les positions idéales planifiées
  for (const { angleOffset, radius } of plannedOffsets) {
    const angle = baseAngle + angleOffset;
    const candX = chestX + Math.cos(angle) * radius;
    const candY = chestY + Math.sin(angle) * radius;

    if (isValidDropPoint(candX, candY, map, results, 0.68)) {
      results.push({ x: candX, y: candY });
    }
  }

  // 2. Si certaines positions tombent dans des murs (coffre contre un mur), recherche radiale de remplacement
  if (results.length < count) {
    const radii = [0.85, 1.05, 0.7, 1.2];
    const angleSteps = 32;

    for (let i = results.length; i < count; i++) {
      let found: Vector2D | null = null;

      for (const r of radii) {
        if (found) break;
        for (let step = 0; step < angleSteps; step++) {
          // Balayage alternatif gauche/droite à partir de l'angle du joueur
          const sign = step % 2 === 0 ? 1 : -1;
          const offset = Math.ceil(step / 2) * ((Math.PI * 2) / angleSteps) * sign;
          const a = baseAngle + offset;
          const testX = chestX + Math.cos(a) * r;
          const testY = chestY + Math.sin(a) * r;

          if (isValidDropPoint(testX, testY, map, results, 0.62)) {
            found = { x: testX, y: testY };
            break;
          }
        }
      }

      if (found) {
        results.push(found);
      } else {
        // En cas de couloir extrêmement étroit, assouplissement de la distance minimale
        const fallbackX = chestX + Math.cos(baseAngle) * (0.6 + i * 0.3);
        const fallbackY = chestY + Math.sin(baseAngle) * (0.6 + i * 0.3);
        results.push({ x: fallbackX, y: fallbackY });
      }
    }
  }

  return results;
}
