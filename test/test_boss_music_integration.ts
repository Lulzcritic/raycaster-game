import assert from 'assert';
import { SoundManager } from '../src/core/SoundManager';

interface SimulatedEntity {
  type: {
    id: string;
    name: string;
    rank: 'normal' | 'elite' | 'boss';
  };
  state: 'idle' | 'aggro' | 'hurt' | 'attacking' | 'dead';
  isAlive(): boolean;
}

/**
 * Reproduction exacte de l'algorithme d'arbitrage musical temps-réel de Game.update()
 */
function updateBossMusicState(entities: SimulatedEntity[], isPlayerAlive: boolean, isExtracted: boolean): void {
  if (!isPlayerAlive || isExtracted) {
    if (SoundManager.isBossMusicActive()) {
      SoundManager.stopBossMusic(1000);
    }
    if (SoundManager.isInGameMusicActive()) {
      SoundManager.stopInGameMusic(1000);
    }
    return;
  }

  const activeBoss = entities.find(
    (e) => e.type.rank === 'boss' && e.isAlive() && e.state !== 'idle'
  );

  if (activeBoss) {
    SoundManager.playBossMusicForEnemy(activeBoss.type.id);
  } else if (SoundManager.isBossMusicActive()) {
    SoundManager.stopBossMusic(1500);
    SoundManager.playInGameMusic(1500);
  }
}

async function runTests() {
  console.log('🧪 Démarrage des tests d\'intégration pour les musiques de combat de boss...\n');

  SoundManager.init();
  SoundManager.stopBossMusic(0);

  console.log('1. Test avec des ennemis normaux (Squelettes, Gobelins)...');
  const normalEntities: SimulatedEntity[] = [
    {
      type: { id: 'skeleton', name: 'Garde Squelette', rank: 'normal' },
      state: 'aggro',
      isAlive: () => true,
    },
    {
      type: { id: 'goblin', name: 'Gobelin au Trésor', rank: 'normal' },
      state: 'hurt',
      isAlive: () => true,
    },
  ];

  updateBossMusicState(normalEntities, true, false);
  assert.strictEqual(SoundManager.getCurrentBossMusic(), null);
  assert.strictEqual(SoundManager.isBossMusicActive(), false);
  console.log('   ✅ Les ennemis normaux en aggro ne déclenchent pas de thème musical de boss.');

  console.log('2. Test de combat contre le Roi Gâteau (carrot_cake_king -> cakeBoss.mp3)...');
  const cakeKingBoss: SimulatedEntity = {
    type: { id: 'carrot_cake_king', name: 'Roi Gâteau à la Carotte', rank: 'boss' },
    state: 'idle',
    isAlive: () => true,
  };
  const entitiesWithCakeKing = [cakeKingBoss];

  // A. Le boss est encore endormi (idle) : aucune musique
  updateBossMusicState(entitiesWithCakeKing, true, false);
  assert.strictEqual(SoundManager.getCurrentBossMusic(), null);
  assert.strictEqual(SoundManager.isBossMusicActive(), false);

  // B. Le joueur s'approche ou attaque le boss : il passe en 'aggro'
  cakeKingBoss.state = 'aggro';
  updateBossMusicState(entitiesWithCakeKing, true, false);
  assert.strictEqual(
    SoundManager.getCurrentBossMusic(),
    'cakeBoss',
    'Le Roi Gâteau éveillé doit déclencher cakeBoss.mp3'
  );
  assert.strictEqual(SoundManager.isBossMusicActive(), true);
  assert.strictEqual(SoundManager.isInGameMusicActive(), false);

  // C. Le boss attaque ou prend des dégâts : le combat continue
  cakeKingBoss.state = 'attacking';
  updateBossMusicState(entitiesWithCakeKing, true, false);
  assert.strictEqual(SoundManager.getCurrentBossMusic(), 'cakeBoss');
  assert.strictEqual(SoundManager.isBossMusicActive(), true);

  // D. Le boss est vaincu (PV = 0, state = dead, isAlive = false)
  cakeKingBoss.state = 'dead';
  cakeKingBoss.isAlive = () => false;
  updateBossMusicState(entitiesWithCakeKing, true, false);
  assert.strictEqual(
    SoundManager.getCurrentBossMusic(),
    null,
    'La mort du boss doit couper sa musique'
  );
  assert.strictEqual(SoundManager.isBossMusicActive(), false);
  assert.strictEqual(SoundManager.isInGameMusicActive(), true, 'La musique par défaut du donjon doit reprendre');
  console.log('   ✅ Cycle complet du combat contre le Roi Gâteau validé.');

  console.log('3. Test de combat contre la Reine de Sang (blood_queen -> bloodQueen.mp3)...');
  const bloodQueenBoss: SimulatedEntity = {
    type: { id: 'blood_queen', name: 'Reine de Sang Écarlate', rank: 'boss' },
    state: 'idle',
    isAlive: () => true,
  };
  const entitiesWithQueen = [bloodQueenBoss];

  // A. Reine endormie
  updateBossMusicState(entitiesWithQueen, true, false);
  assert.strictEqual(SoundManager.getCurrentBossMusic(), null);

  // B. Éveil de la reine
  bloodQueenBoss.state = 'aggro';
  updateBossMusicState(entitiesWithQueen, true, false);
  assert.strictEqual(
    SoundManager.getCurrentBossMusic(),
    'bloodQueen',
    'La Reine de Sang éveillée doit déclencher bloodQueen.mp3'
  );
  assert.strictEqual(SoundManager.isBossMusicActive(), true);

  // C. Si le joueur meurt pendant le combat contre le boss
  updateBossMusicState(entitiesWithQueen, false, false);
  assert.strictEqual(
    SoundManager.getCurrentBossMusic(),
    null,
    'La mort du joueur doit immédiatement éteindre la musique de boss'
  );
  assert.strictEqual(SoundManager.isBossMusicActive(), false);
  console.log('   ✅ Cycle de combat contre la Reine de Sang et extinction à la mort du joueur validés.');

  console.log('4. Test d\'interruption lors de l\'extraction réussie...');
  // Réactivation du combat
  bloodQueenBoss.state = 'aggro';
  updateBossMusicState(entitiesWithQueen, true, false);
  assert.strictEqual(SoundManager.getCurrentBossMusic(), 'bloodQueen');

  // Extraction réussie
  updateBossMusicState(entitiesWithQueen, true, true);
  assert.strictEqual(
    SoundManager.getCurrentBossMusic(),
    null,
    'L\'extraction doit couper la musique de boss'
  );
  assert.strictEqual(SoundManager.isBossMusicActive(), false);
  console.log('   ✅ Coupure de la musique lors de l\'extraction validée.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS D\'INTÉGRATION DES MUSIQUES DE BOSS ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erreur lors du test :', err);
  process.exit(1);
});
