import assert from 'node:assert';

// Mock DOM minimaliste pour Node.js
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

if (typeof (globalThis as any).Audio === 'undefined') {
  (globalThis as any).Audio = class {
    public play = async () => {};
    public pause = () => {};
    public load = () => {};
    public src = '';
    public volume = 1;
    public loop = false;
    public addEventListener = () => {};
    public removeEventListener = () => {};
  };
}

if (typeof (globalThis as any).document === 'undefined') {
  const dummyCanvas: any = {
    width: 256,
    height: 256,
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
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
    }),
    focus: () => {},
    requestPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return dummyCanvas;
      return {
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        setAttribute: () => {},
        getAttribute: () => null,
      };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    exitPointerLock: () => {},
    pointerLockElement: null,
  };

  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

import { InputManager } from '../src/core/InputManager';
import { Player } from '../src/entities/Player';
import { Cat } from '../src/entities/Cat';
import { Entity } from '../src/entities/Entity';
import { GameMap } from '../src/world/GameMap';
import { I18nService } from '../src/core/I18nService';

console.log('⚔️ Démarrage des tests du Menu En Jeu & Monde Multijoueur Temps Réel...\n');

async function runTests() {
  // =========================================================================
  // 1. DÉCONNEXION DES ENTRÉES DU JOUEUR MAIS SURVIE DANS LE MONDE
  // =========================================================================
  console.log('1. Test de libération de la souris et désactivation des mouvements locaux...');
  const fakeCanvas: any = {
    focus: () => {},
    requestPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  let pauseCallbackInvoked = false;
  let pauseState = false;

  const input = new InputManager(fakeCanvas, (paused) => {
    pauseCallbackInvoked = true;
    pauseState = paused;
  });

  assert.strictEqual(input.isPaused(), false, 'Au démarrage, les entrées ne sont pas en pause');

  // Simulation de l'appui sur Échap / déverrouillage du pointeur
  input.setPaused(true);
  assert.strictEqual(input.isPaused(), true);
  assert.strictEqual(pauseCallbackInvoked, true);
  assert.strictEqual(pauseState, true);

  // Vérification que les touches de déplacement ne produisent aucun mouvement
  assert.strictEqual(input.isKeyDown('w'), false);
  assert.strictEqual(input.isKeyDown('z'), false);
  assert.strictEqual(input.isMouseLeftDown(), false);
  assert.strictEqual(input.isMouseRightDown(), false);
  assert.strictEqual(input.consumeMouseDeltaX(), 0);
  console.log('   ✅ Entrées joueur désactivées et souris libérée avec succès.');

  // =========================================================================
  // 2. LES MONSTRES ET LE MONDE CONTINUENT D'ÉVOLUER EN TEMPS RÉEL
  // =========================================================================
  console.log('\n2. Test de continuité du monde : les monstres continuent de bouger et d\'attaquer...');
  const simpleGrid = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  const map = new GameMap(simpleGrid);

  const player = new Player(input, { x: 2.5, y: 2.5 });
  player.maxHealth = 100;
  player.health = 100;

  // Monstre simulé dans le monde 3D
  class LiveDungeonMonster extends Entity {
    public target: Player;
    constructor(x: number, y: number, target: Player) {
      super(x, y);
      this.target = target;
    }
    public update(deltaTime: number, _map: GameMap): void {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.45) {
        const step = Math.min(dist - 0.3, 2.0 * deltaTime);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
      if (Math.hypot(this.target.x - this.x, this.target.y - this.y) <= 0.45) {
        this.target.takeDamage(25);
      }
    }
  }

  const monster = new LiveDungeonMonster(5.0, 2.5, player);
  const liveCat = new Cat(2.5, 3.0);

  // Le joueur a ouvert le menu d'échap (input.paused = true)
  // Il ne peut pas bouger :
  const startX = player.x;
  const startY = player.y;
  player.update(0.5, map);
  assert.strictEqual(player.x, startX, 'Le joueur en menu ne doit pas se déplacer');
  assert.strictEqual(player.y, startY, 'Le joueur en menu ne doit pas se déplacer');

  // MAIS le monstre continue sa traque en temps réel :
  const initialDist = Math.hypot(monster.x - player.x, monster.y - player.y);
  monster.update(0.5, map);
  const newDist = Math.hypot(monster.x - player.x, monster.y - player.y);
  assert.ok(
    newDist < initialDist,
    `Le monstre doit s'approcher du joueur même si le menu est ouvert (${newDist} < ${initialDist})`
  );

  // Le chat continue aussi sa déambulation
  liveCat.update(1.0, map);
  assert.ok(liveCat.animTimer > 0, 'Le chat compagnon continue d\'évoluer en arrière-plan');

  // Le monstre arrive au contact et attaque le joueur immobile
  const hpBefore = player.health;
  monster.update(2.0, map);

  assert.ok(
    player.health < hpBefore,
    `Le joueur doit subir des dégâts en temps réel s'il est attaqué dans le menu (PV: ${player.health} < ${hpBefore})`
  );
  console.log(`   ✅ Le monstre a traqué le joueur et lui a infligé des dégâts (${hpBefore} -> ${player.health} PV) pendant que le menu était ouvert.`);

  // =========================================================================
  // 3. TRADUCTIONS ET AVERTISSEMENT DU MENU EN TEMPS RÉEL (FR / EN)
  // =========================================================================
  console.log('\n3. Vérification des libellés et avertissements bilingues du Menu En Jeu...');
  I18nService.setLanguage('fr');
  assert.strictEqual(I18nService.t('pause.title'), 'MENU EN JEU');
  assert.ok(I18nService.t('pause.warning').includes('TEMPS RÉEL'));

  I18nService.setLanguage('en');
  assert.strictEqual(I18nService.t('pause.title'), 'IN-GAME MENU');
  assert.ok(I18nService.t('pause.warning').includes('REAL-TIME'));
  console.log('   ✅ Libellés bilingues validés.');

  console.log('\n🎉 TOUS LES TESTS DE CONTINUITÉ DU MONDE EN TEMPS RÉEL ONT RÉUSSI !');
}

runTests().catch((err) => {
  console.error('❌ Échec du test :', err);
  process.exit(1);
});
