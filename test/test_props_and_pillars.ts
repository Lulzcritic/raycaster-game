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
assert(tables.length > 0, 'Il doit y avoir des tables disséminées sur la carte');

// Vérification de la règle stricte : aucun prop entre deux murs opposés
const seedsToTest = [101, 202, 303, 4242, 9999];
for (const seed of seedsToTest) {
  const testLevel = MapGenerator.generate({ seed });
  const mapGrid = testLevel.grid;
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
      return t === TILE_TYPE.WALL_1 || t === TILE_TYPE.DOOR;
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
  }
}
console.log('   ✅ Règle validée : 100% des props ont un passage libre à côté et aucun n\'est entre deux murs.\n');

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

console.log('======================================================');
console.log('🎉 TOUS LES TESTS DES PROPS & PILIERS ONT RÉUSSI !');
console.log('======================================================');
