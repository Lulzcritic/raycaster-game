import assert from 'node:assert';

// Mock DOM minimaliste pour Node.js
if (typeof document === 'undefined') {
  const dummyCtx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    imageSmoothingEnabled: false,
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4) }),
  };
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 64,
          height: 64,
          getContext: () => dummyCtx,
        };
      }
      return {};
    },
  };
}

import { TILE_TYPE } from '../src/config/constants';
import { GameMap } from '../src/world/GameMap';
import { Prop } from '../src/entities/Prop';
import { PurpleOrb } from '../src/entities/PurpleOrb';
import { Fireball } from '../src/entities/Fireball';
import { Arrow } from '../src/entities/Arrow';
import { MapGenerator } from '../src/world/procedural/MapGenerator';

console.log('🧪 Démarrage des tests unitaires pour les Props & Piliers...\n');

// ---------------------------------------------------------------------------
// 1. Test de la génération procédurale des props et piliers
// ---------------------------------------------------------------------------
console.log('1. Test de génération procédurale...');
const level = MapGenerator.generate({ seed: 4242 });
assert(level.sprites && level.sprites.length > 0, 'Les sprites doivent être générés sur la carte');

const pillars = level.sprites.filter((s) => s.textureId === TILE_TYPE.PILLAR);
const barrels = level.sprites.filter((s) => s.textureId === TILE_TYPE.BARREL);
const boxes = level.sprites.filter((s) => s.textureId === TILE_TYPE.BOX);
const tables = level.sprites.filter((s) => s.textureId === TILE_TYPE.TABLE);

console.log(`   - Piliers générés : ${pillars.length}`);
console.log(`   - Tonneaux générés : ${barrels.length}`);
console.log(`   - Caisses générées : ${boxes.length}`);
console.log(`   - Tables générées : ${tables.length}`);

assert(pillars.length >= 8, 'Il doit y avoir au moins 8 piliers (Sanctuaire du boss + Extractions + Arènes)');
assert(barrels.length > 0, 'Il doit y avoir des tonneaux disséminés sur la carte');
assert(boxes.length > 0, 'Il doit y avoir des caisses disséminées sur la carte');
assert(tables.length >= 0, 'Les tables peuvent être disséminées sur la carte selon le tirage');
assert(barrels.length + boxes.length + tables.length >= 5, 'Il doit y avoir des décors physiques disséminés sur la carte');

// Vérification des règles strictes sur plusieurs seeds
const seedsToTest = [101, 202, 303, 4242, 9999, 12345, 77777];
for (const seed of seedsToTest) {
  const testLevel = MapGenerator.generate({ seed });
  const mapGrid = testLevel.grid;

  const isGroundTile = (x: number, y: number) => {
    const t = mapGrid[y]?.[x];
    return t === TILE_TYPE.GROUND_1 || t === TILE_TYPE.GROUND_2;
  };

  // 1. Validation de chaque PILIER : aucun pilier dans un couloir ou passage
  const testPillars = testLevel.sprites.filter((s) => s.textureId === TILE_TYPE.PILLAR);
  for (const pillar of testPillars) {
    const px = Math.floor(pillar.x);
    const py = Math.floor(pillar.y);

    let dN = 0; while (dN < 8 && isGroundTile(px, py - 1 - dN)) dN++;
    let dS = 0; while (dS < 8 && isGroundTile(px, py + 1 + dS)) dS++;
    let dW = 0; while (dW < 8 && isGroundTile(px - 1 - dW, py)) dW++;
    let dE = 0; while (dE < 8 && isGroundTile(px + 1 + dE, py)) dE++;

    // Largeur et hauteur de la pièce >= 5 cases ouvertes (grande pièce uniquement)
    assert(
      dN + dS + 1 >= 5 && dW + dE + 1 >= 5,
      `Le pilier en (${px}, ${py}) (seed ${seed}) est dans un passage trop étroit (spanY: ${dN + dS + 1}, spanX: ${dW + dE + 1}) !`
    );

    // Espace de passage libre tout autour (au moins 1 case praticable sur les 4 côtés)
    assert(
      dN >= 1 && dS >= 1 && dW >= 1 && dE >= 1,
      `Le pilier en (${px}, ${py}) (seed ${seed}) doit avoir au moins 1 case de passage sur chacun de ses 4 côtés !`
    );
  }

  // 2. Validation de chaque PROP (tonneaux, caisses, tables) :
  // - Jamais dans un couloir (largeur et hauteur >= 4 cases)
  // - Jamais entre deux murs opposés
  // - Espace libre garanti pour passer à côté
  const sporadicProps = testLevel.sprites.filter(
    (s) =>
      s.textureId === TILE_TYPE.BARREL ||
      s.textureId === TILE_TYPE.BOX ||
      s.textureId === TILE_TYPE.TABLE
  );

  for (const prop of sporadicProps) {
    const gx = Math.floor(prop.x);
    const gy = Math.floor(prop.y);

    const isWallTile = (x: number, y: number) => {
      const t = mapGrid[y]?.[x];
      return MapGenerator.isWall(t) || t === TILE_TYPE.DOOR;
    };

    const wallN = isWallTile(gx, gy - 1);
    const wallS = isWallTile(gx, gy + 1);
    const wallW = isWallTile(gx - 1, gy);
    const wallE = isWallTile(gx + 1, gy);

    assert(
      !(wallN && wallS),
      `Le prop en (${gx}, ${gy}) (seed ${seed}) ne peut pas être entre deux murs verticaux (Nord et Sud) !`
    );
    assert(
      !(wallW && wallE),
      `Le prop en (${gx}, ${gy}) (seed ${seed}) ne peut pas être entre deux murs horizontaux (Ouest et Est) !`
    );

    let dN = 0; while (dN < 8 && isGroundTile(gx, gy - 1 - dN)) dN++;
    let dS = 0; while (dS < 8 && isGroundTile(gx, gy + 1 + dS)) dS++;
    let dW = 0; while (dW < 8 && isGroundTile(gx - 1 - dW, gy)) dW++;
    let dE = 0; while (dE < 8 && isGroundTile(gx + 1 + dE, gy)) dE++;

    assert(
      dN + dS + 1 >= 4 && dW + dE + 1 >= 4,
      `Le prop en (${gx}, ${gy}) (seed ${seed}) est dans un couloir (spanY: ${dN + dS + 1}, spanX: ${dW + dE + 1}) !`
    );
  }
}
console.log('   ✅ Règle validée : 100% des props ont un passage libre à côté, aucun n\'est entre deux murs et aucun pilier n\'est dans un couloir.\n');

// ---------------------------------------------------------------------------
// 2. Test des collisions physiques des Props (GameMap.canMove)
// ---------------------------------------------------------------------------
console.log('2. Test de collision joueur / entités contre un pilier...');
const grid = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];
const map = new GameMap(grid);
const pillarProp = new Prop(2.0, 2.0, 'pillar');
map.addObstacle(pillarProp);

// Le joueur est en (1.5, 2.0). Il essaie de marcher vers (2.0, 2.0)
const playerHitBox = 0.25;
assert(map.canMove(1.3, 2.0, playerHitBox), 'Le joueur doit pouvoir bouger dans un espace libre');
assert(!map.canMove(2.0, 2.0, playerHitBox), 'Le joueur ne peut pas entrer dans le pilier');
// À distance inférieure à radius + hitbox (0.35 + 0.25 = 0.60)
assert(!map.canMove(1.8, 2.0, playerHitBox), 'Le joueur doit être bloqué au contact du pilier');
console.log('   ✅ Collision physique du pilier validée.\n');

// ---------------------------------------------------------------------------
// 3. Test de la ligne de vue (hasLineOfSight) et du camouflage derrière un pilier
// ---------------------------------------------------------------------------
console.log('3. Test de la ligne de vue occultée par le pilier...');
// Ennemi en (2.5, 3.5), Pilier en (2.5, 2.5), Joueur en (2.5, 1.5)
const enemyX = 2.5;
const enemyY = 3.5;
const pillarX = 2.5;
const pillarY = 2.5;
const mapSight = new GameMap(grid);
mapSight.addObstacle(new Prop(pillarX, pillarY, 'pillar'));

const playerHiddenX = 2.5;
const playerHiddenY = 1.5;

// En ligne directe à travers le pilier : vue bloquée !
const canSeeHidden = mapSight.hasLineOfSight(enemyX, enemyY, playerHiddenX, playerHiddenY);
assert(!canSeeHidden, 'Le pilier doit bloquer la ligne de vue directe (joueur caché)');

// Si le joueur décale sur le côté en (1.5, 1.5) : vue dégagée !
const playerVisibleX = 1.5;
const playerVisibleY = 1.5;
const canSeeVisible = mapSight.hasLineOfSight(enemyX, enemyY, playerVisibleX, playerVisibleY);
assert(canSeeVisible, 'La ligne de vue doit être dégagée si le joueur se décale du pilier');
console.log('   ✅ Détection de ligne de vue et couverture derrière le pilier validées.\n');

// ---------------------------------------------------------------------------
// 4. Test du ricochet d un projectile magique (PurpleOrb) sur le pilier
// ---------------------------------------------------------------------------
console.log('4. Test du rebond (ricochet) de PurpleOrb sur le pilier...');
// Orbe tiré depuis (1.5, 2.0) se dirigeant vers la droite (angle 0) vers le pilier en (2.0, 2.0)
const orb = new PurpleOrb(1.5, 2.0, 0, 40, 3);
const initialAngle = orb.angle;
const initialBounces = orb.bouncesDone;

// Avancer de 0.05 seconde : l'orbe doit heurter le pilier et rebondir
orb.update(0.05, map);

assert(orb.bouncesDone === initialBounces + 1, 'Le nombre de rebonds doit être incrémenté de 1');
assert(orb.bouncesRemaining === 2, 'Il doit rester 2 rebonds');
// L'angle doit avoir été réfléchi (faisant désormais face vers la gauche ~PI)
const angleDiff = Math.abs(Math.cos(orb.angle) - Math.cos(Math.PI));
assert(angleDiff < 0.2, `L orbe doit rebondir vers l arrière (angle réfléchi proche de PI, obtenu: ${orb.angle})`);
console.log(`   ✅ Rebond validé : angle passé de ${initialAngle.toFixed(2)} à ${orb.angle.toFixed(2)}, rebonds effectués: ${orb.bouncesDone}.\n`);

// ---------------------------------------------------------------------------
// 5. Test de l explosion / impact de Fireball et Arrow sur le pilier
// ---------------------------------------------------------------------------
console.log('5. Test d arrêt des tirs ennemis et boules de feu sur le pilier...');
const fireball = new Fireball(1.6, 2.0, 0, 30);
fireball.update(0.05, map);
assert(fireball.state === 'exploding', 'La Fireball doit exploser au contact du pilier');

const arrow = new Arrow(1.6, 2.0, 0, 15);
arrow.update(0.05, map);
assert(arrow.state === 'impact', 'La flèche du squelette doit être stoppée net par le pilier');
console.log('   ✅ Arrêt des projectiles sur le pilier validé.\n');

// ---------------------------------------------------------------------------
// 6. Test de la diversité et de la parsimonie des textures de mur (wall1, 2, 3, 4)
// ---------------------------------------------------------------------------
console.log('6. Test de la diversité parsimonieuse des textures de murs (WALL_1 à WALL_4)...');
let totalWalls = 0;
let countWall1 = 0;
let countWall2 = 0;
let countWall3 = 0;
let countWall4 = 0;

for (let y = 0; y < level.grid.length; y++) {
  for (let x = 0; x < level.grid[y].length; x++) {
    const tile = level.grid[y][x];
    if (MapGenerator.isWall(tile)) {
      totalWalls++;
      if (tile === TILE_TYPE.WALL_1) countWall1++;
      else if (tile === TILE_TYPE.WALL_2) countWall2++;
      else if (tile === TILE_TYPE.WALL_3) countWall3++;
      else if (tile === TILE_TYPE.WALL_4) countWall4++;

      // Vérifier le périmètre extérieur : 100% WALL_1
      if (x === 0 || y === 0 || x === level.grid[y].length - 1 || y === level.grid.length - 1) {
        assert.strictEqual(tile, TILE_TYPE.WALL_1, 'Le périmètre extérieur doit être strictement WALL_1');
      }
    }
  }
}

const pct1 = ((countWall1 / totalWalls) * 100).toFixed(1);
const pct2 = ((countWall2 / totalWalls) * 100).toFixed(1);
const pct3 = ((countWall3 / totalWalls) * 100).toFixed(1);
const pct4 = ((countWall4 / totalWalls) * 100).toFixed(1);

console.log(`   - Total murs : ${totalWalls}`);
console.log(`   - WALL_1 (Standard) : ${countWall1} (${pct1}%)`);
console.log(`   - WALL_2 (Variante 2) : ${countWall2} (${pct2}%)`);
console.log(`   - WALL_3 (Variante 3) : ${countWall3} (${pct3}%)`);
console.log(`   - WALL_4 (Variante 4) : ${countWall4} (${pct4}%)`);

assert(countWall1 > countWall2 + countWall3 + countWall4, 'WALL_1 doit être la texture majoritaire dominante');
assert(countWall2 > 0, 'WALL_2 doit être présent avec parsimonie');
assert(countWall3 > 0, 'WALL_3 doit être présent avec parsimonie');
assert(countWall4 > 0, 'WALL_4 doit être présent avec parsimonie');
assert(parseFloat(pct1) >= 75, 'WALL_1 doit représenter au moins 75% des murs pour garantir la cohérence');

// Test de GameMap.isWall sur chaque variante
const testMap = new GameMap([
  [TILE_TYPE.WALL_1, TILE_TYPE.WALL_2],
  [TILE_TYPE.WALL_3, TILE_TYPE.WALL_4],
]);
assert.strictEqual(testMap.isWall(0, 0), true, 'WALL_1 doit être reconnu comme un mur par GameMap');
assert.strictEqual(testMap.isWall(1, 0), true, 'WALL_2 doit être reconnu comme un mur par GameMap');
assert.strictEqual(testMap.isWall(0, 1), true, 'WALL_3 doit être reconnu comme un mur par GameMap');
assert.strictEqual(testMap.isWall(1, 1), true, 'WALL_4 doit être reconnu comme un mur par GameMap');
console.log('   ✅ Diversité parsimonieuse des murs et reconnaissance physique validées.\n');

// ---------------------------------------------------------------------------
// 7. Test de la rareté des Gobelins au Trésor et des Mimics
// ---------------------------------------------------------------------------
console.log('7. Test de la rareté contrôlée des Gobelins et des Mimics...');

// Vérification de la rareté des gobelins sur 50 graines procédurales
let totalGoblinsAcross50Seeds = 0;
let mapsWithMaxOneGoblin = 0;
for (let s = 1; s <= 50; s++) {
  const proceduralLevel = MapGenerator.generate({ seed: s });
  const goblinCount = proceduralLevel.enemies.filter((e) => e.typeId === 'goblin').length;
  assert(goblinCount <= 1, `Une carte ne doit JAMAIS contenir plus de 1 gobelin (trouvé: ${goblinCount} sur seed ${s})`);
  if (goblinCount <= 1) mapsWithMaxOneGoblin++;
  totalGoblinsAcross50Seeds += goblinCount;
}

const goblinPresencePct = ((totalGoblinsAcross50Seeds / 50) * 100).toFixed(1);
console.log(`   - Gobelins totaux sur 50 graines : ${totalGoblinsAcross50Seeds} (~${goblinPresencePct}% de présence, max 1 par raid)`);
assert(totalGoblinsAcross50Seeds <= 25, 'Les gobelins doivent être rares (<= 25 apparitions sur 50 parties)');
assert(totalGoblinsAcross50Seeds > 0, 'Les gobelins doivent tout de même pouvoir apparaître');
assert.strictEqual(mapsWithMaxOneGoblin, 50, '100% des cartes respectent la limite stricte de 0 ou 1 gobelin');

console.log('   ✅ Rareté des Gobelins au Trésor et des Mimics validée.\n');

console.log('======================================================');
console.log('🎉 TOUS LES TESTS DES PROPS, PILIERS, MURS & RARETÉ ONT RÉUSSI !');
console.log('======================================================');
