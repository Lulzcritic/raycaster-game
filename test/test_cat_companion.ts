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
  };
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => dummyCtx,
        };
      }
      return {};
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

import { TILE_TYPE } from '../src/config/constants';
import { GameMap } from '../src/world/GameMap';
import { MapGenerator } from '../src/world/procedural/MapGenerator';
import { Cat } from '../src/entities/Cat';
import { Player } from '../src/entities/Player';
import { InputManager } from '../src/core/InputManager';
import { I18nService } from '../src/core/I18nService';
import { SoundManager } from '../src/core/SoundManager';
import { CatSpriteManager } from '../src/graphics/CatSpriteManager';

console.log('🐱 Démarrage de la suite de tests pour le Chat Compagnon...\n');

async function runTests() {
  // =========================================================================
  // 1. GÉNÉRATION PROCÉDURALE (2 ou 3 chats par donjon)
  // =========================================================================
  console.log('1. Vérification de la génération procédurale des chats...');
  const catCounts: number[] = [];

  for (let seed = 1001; seed <= 1015; seed++) {
    const level = MapGenerator.generate({ seed, playerGearScore: 50 });
    assert.ok(level.cats, `Le niveau (seed ${seed}) doit comporter une liste de chats`);
    const count = level.cats.length;
    assert.ok(
      count === 2 || count === 3,
      `Chaque donjon doit générer 2 ou 3 chats (généré: ${count} pour seed ${seed})`
    );
    catCounts.push(count);

    // Vérifier que chaque chat est situé sur une case praticable
    for (const catData of level.cats) {
      const tileX = Math.floor(catData.x);
      const tileY = Math.floor(catData.y);
      const tileId = level.grid[tileY][tileX];
      assert.strictEqual(
        tileId,
        TILE_TYPE.GROUND_1,
        `Le chat à (${catData.x}, ${catData.y}) doit être posé sur un sol praticable (case ${tileX},${tileY} est ${tileId})`
      );
    }
  }

  const hasTwo = catCounts.includes(2);
  const hasThree = catCounts.includes(3);
  assert.ok(hasTwo && hasThree, 'La génération doit produire alternativement 2 ou 3 chats selon la seed');
  console.log(`   ✅ 15 donjons testés : tous contiennent 2 ou 3 chats sur du sol praticable (répartition: ${catCounts.join(', ')}).`);

  // =========================================================================
  // 2. PROPRIÉTÉS ET ANCRAGE AU SOL DU CHAT
  // =========================================================================
  console.log('\n2. Vérification des propriétés initiales et de l\'ancrage...');
  const cat = new Cat(10.5, 12.5);
  assert.strictEqual(cat.state, 'wandering', 'Le chat doit démarrer en état de déambulation (wandering)');
  assert.strictEqual(cat.isFloorAnchored(), true, 'Le chat doit être ancré au sol');
  assert.strictEqual(cat.getScale(), 0.42, 'L\'échelle du chat doit être de 0.42');
  assert.strictEqual(cat.isInteractable(), true, 'Le chat doit être interactif');
  assert.strictEqual(cat.active, true, 'Le chat doit être actif');
  console.log('   ✅ Propriétés et ancrage au sol validés.');

  // =========================================================================
  // 3. PROMPTS D\'INTERACTION BILINGUES
  // =========================================================================
  console.log('\n3. Vérification des invites d\'interaction (FR / EN)...');
  I18nService.setLanguage('fr');
  assert.strictEqual(cat.getInteractionPrompt(), '[F] CARESSER LE CHAT (+35% PV)');

  I18nService.setLanguage('en');
  assert.strictEqual(cat.getInteractionPrompt(), '[F] PET THE CAT (+35% HP)');

  I18nService.setLanguage('fr'); // Remise en français
  console.log('   ✅ Prompts bilingues conformes.');

  // =========================================================================
  // 4. CARESSES ET SOIN DE 35% DES PV MAX
  // =========================================================================
  console.log('\n4. Test de la caresse et de la régénération de 35% des PV...');
  const fakeInput: any = {
    isPressed: () => false,
    consumeKeyPress: () => false,
    getMoveVector: () => ({ x: 0, y: 0 }),
    getMouseDeltaX: () => 0,
    resetMouseDelta: () => {},
  };
  const player = new Player(fakeInput, { x: 10.5, y: 12.5 });
  player.maxHealth = 100;
  player.takeDamage(70); // PV = 30
  assert.strictEqual(player.health, 30);

  const expectedHeal = Math.round(100 * Cat.HEAL_PERCENT); // 35
  const feedback = cat.interact(player);
  assert.strictEqual(player.health, 65, 'Le joueur avec 30 PV doit monter à 65 PV (+35 PV)');
  assert.ok(feedback?.includes('+35 PV'), `Le message de notification doit mentionner +35 PV : "${feedback}"`);
  assert.strictEqual(cat.state, 'purring', 'Le chat caressé doit passer en état ronronnement (purring)');
  assert.strictEqual(cat.isInteractable(), false, 'Pendant le ronronnement, le chat n\'est plus interactif');
  console.log(`   ✅ PV restaurés : 30 -> ${player.health} (+35 PV) et état purring enclenché.`);

  // =========================================================================
  // 5. CYCLE DE RONRONNEMENT PUIS SOMMEIL DE 1 MINUTE (60s)
  // =========================================================================
  console.log('\n5. Test du cycle de ronronnement (3.5s) puis endormissement (60s)...');
  const simpleMap = new GameMap([
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ]);

  // Avancement de 3.5s
  cat.update(Cat.PURR_DURATION, simpleMap);
  assert.strictEqual(cat.state, 'sleeping', 'Après le ronronnement, le chat doit s\'endormir');
  assert.strictEqual(cat.sleepTimer, Cat.SLEEP_DURATION, 'Le timer de sommeil doit être initialisé à 60s');
  assert.strictEqual(cat.isInteractable(), true, 'Le chat endormi est inspectable/interactif (affiche son repos)');

  const sleepPrompt = cat.getInteractionPrompt();
  assert.ok(
    sleepPrompt?.includes('dort paisiblement'),
    `Le prompt pendant le sommeil doit indiquer que le chat dort : "${sleepPrompt}"`
  );

  // Tentative de caresser le chat endormi
  player.takeDamage(20);
  const hpBeforeSleepingInteract = player.health;
  const sleepFeedback = cat.interact(player);
  assert.strictEqual(
    player.health,
    hpBeforeSleepingInteract,
    'Interagir avec le chat endormi ne doit PAS redonner de PV'
  );
  assert.ok(
    sleepFeedback?.includes('dort profondément'),
    `Le message de retour doit indiquer le repos : "${sleepFeedback}"`
  );
  console.log('   ✅ Le chat s\'endort pour 60s et ne donne aucun PV durant son sommeil.');

  // =========================================================================
  // 6. FIN DE LA MINUTE : RÉVEIL RECHARGÉ
  // =========================================================================
  console.log('\n6. Test du réveil après 60 secondes et recharge du soin...');
  // Écoulement de 30 secondes
  cat.update(30, simpleMap);
  assert.strictEqual(cat.state, 'sleeping');
  assert.strictEqual(Math.round(cat.sleepTimer), 30);

  // Écoulement des 30 secondes restantes
  cat.update(30.1, simpleMap);
  assert.strictEqual(cat.state, 'wandering', 'Après 60s écoulées, le chat doit se réveiller et déambuler');

  // Nouvelle caresse disponible !
  const feedbackAfterWake = cat.interact(player);
  assert.ok(
    feedbackAfterWake?.includes('+'),
    `Après réveil, le chat doit pouvoir soigner à nouveau : "${feedbackAfterWake}"`
  );
  assert.strictEqual(cat.state, 'purring');
  console.log('   ✅ Réveil automatique et recharge confirmés.');

  // =========================================================================
  // 7. INVULNÉRABILITÉ DU CHAT
  // =========================================================================
  console.log('\n7. Vérification de l\'invulnérabilité (immunité aux attaques)...');
  cat.takeDamage(9999);
  assert.strictEqual(cat.active, true, 'Le chat ne doit pas mourir ni se désactiver');
  console.log('   ✅ Invulnérabilité validée (immunité complète).');

  // =========================================================================
  // 8. SPRITES ET SONS DU CHAT
  // =========================================================================
  console.log('\n8. Vérification des assets sonores et graphiques...');
  // Vérification de SoundManager
  SoundManager.init();
  SoundManager.play3D('catMeow', 10, 10);
  SoundManager.play3D('catPurr', 10, 10);
  assert.ok(true, 'Les sons catMeow et catPurr doivent être jouables sans erreur');

  // Vérification du Sprite Manager
  const spriteWander = CatSpriteManager.getSprite('wandering', 0.5);
  const spriteSleep = CatSpriteManager.getSprite('sleeping', 0.5);
  const spritePurr = CatSpriteManager.getSprite('purring', 0.5);
  const spriteIdle = CatSpriteManager.getSprite('idle', 0.5);
  assert.ok(spriteWander !== undefined, 'Un sprite de marche doit être disponible');
  assert.ok(spriteSleep !== undefined, 'Un sprite de sommeil doit être disponible');
  assert.ok(spritePurr !== undefined, 'Un sprite de ronronnement doit être disponible');
  assert.ok(spriteIdle !== undefined, 'Un sprite d\'observation doit être disponible');
  console.log('   ✅ Sprites et effets audio validés.');

  console.log('\n🎉 TOUS LES TESTS DU CHAT COMPAGNON ONT RÉUSSI AVEC SUCCÈS !');
}

runTests().catch((err) => {
  console.error('❌ Échec du test :', err);
  process.exit(1);
});
