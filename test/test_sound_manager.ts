import assert from 'assert';
import { SoundManager } from '../src/core/SoundManager';

async function runTests() {
  console.log('🧪 Démarrage des tests du SoundManager...\n');

  console.log('1. Test de résilience en environnement Node.js / Headless...');
  // SoundManager doit pouvoir être initialisé sans planter en headless
  SoundManager.init();
  SoundManager.playMenuMusic();
  SoundManager.playButtonSound();
  SoundManager.play2D('button');
  SoundManager.play3D('chestOpening', 10, 10);
  SoundManager.play3D('slimeDeath', 5, 5);
  SoundManager.stopMenuMusic(0);

  // Vérification des modificateurs de volume
  SoundManager.setMusicVolume(0.5);
  SoundManager.setSfxVolume(0.6);
  assert.ok(true, 'SoundManager doit fonctionner sans exception en environnement headless');
  console.log('   ✅ Résilience validée.');

  console.log('2. Test du tracking de la position et angle de l\'auditeur (listener)...');
  SoundManager.updateListener(12.5, 8.0, Math.PI / 4);
  const listener = SoundManager.getListener();
  assert.strictEqual(listener.x, 12.5);
  assert.strictEqual(listener.y, 8.0);
  assert.strictEqual(listener.angle, Math.PI / 4);
  console.log('   ✅ Listener tracking validé : (x=12.5, y=8.0, angle=0.785 rad).');

  console.log('3. Test des calculs spatiaux 3D (Panoramique stéréo gauche / droite)...');
  // Écouteur en (0, 0) orienté vers +X (angle = 0)
  // Devant : (5, 0) -> pan ≈ 0
  const frontAudio = SoundManager.calculateSpatialAudio(5, 0, 0, 0, 0);
  assert.ok(Math.abs(frontAudio.pan) < 0.01, `Le son devant doit être centré (pan ≈ 0), obtenu: ${frontAudio.pan}`);
  assert.strictEqual(frontAudio.isBehind, false);
  assert.strictEqual(frontAudio.behindFactor, 0);

  // À droite : (0, 5) -> pan ≈ +1 (100% oreille droite)
  const rightAudio = SoundManager.calculateSpatialAudio(0, 5, 0, 0, 0);
  assert.ok(Math.abs(rightAudio.pan - 1) < 0.01, `Le son à droite doit avoir pan ≈ +1, obtenu: ${rightAudio.pan}`);
  assert.strictEqual(rightAudio.isBehind, false);

  // À gauche : (0, -5) -> pan ≈ -1 (100% oreille gauche)
  const leftAudio = SoundManager.calculateSpatialAudio(0, -5, 0, 0, 0);
  assert.ok(Math.abs(leftAudio.pan - (-1)) < 0.01, `Le son à gauche doit avoir pan ≈ -1, obtenu: ${leftAudio.pan}`);
  assert.strictEqual(leftAudio.isBehind, false);

  // Derrière : (-5, 0) -> pan ≈ 0, isBehind = true, behindFactor ≈ 1.0 (occlusion passe-bas)
  const backAudio = SoundManager.calculateSpatialAudio(-5, 0, 0, 0, 0);
  assert.ok(Math.abs(backAudio.pan) < 0.01, `Le son derrière doit être centré (pan ≈ 0), obtenu: ${backAudio.pan}`);
  assert.strictEqual(backAudio.isBehind, true);
  assert.ok(Math.abs(backAudio.behindFactor - 1) < 0.01, `Le son directement derrière doit avoir behindFactor ≈ 1`);
  console.log('   ✅ Panoramique stéréo et occlusion arrière validés.');

  console.log('4. Test de rotation de la caméra / écouteur...');
  // Si le joueur tourne de 90° vers la droite (angle = PI/2),
  // l'objet en (5, 0) qui était devant se retrouve maintenant à sa GAUCHE (-90°) !
  const rotatedAudio = SoundManager.calculateSpatialAudio(5, 0, 0, 0, Math.PI / 2);
  assert.ok(Math.abs(rotatedAudio.pan - (-1)) < 0.01, `Avec joueur orienté à PI/2, objet en +X doit être à gauche (pan ≈ -1), obtenu: ${rotatedAudio.pan}`);
  console.log('   ✅ Calculs angulaires relatifs sous rotation validés.');

  console.log('5. Test de l\'atténuation de distance (Roll-off) et portée maximale...');
  // Son dans la refDistance (ex: dist = 1.0 <= refDist 1.2)
  const closeAudio = SoundManager.calculateSpatialAudio(1.0, 0, 0, 0, 0, { refDistance: 1.2, maxDistance: 15 });
  assert.strictEqual(closeAudio.attenuation, 1.0, 'Son à courte distance doit avoir une atténuation de 1.0 (volume plein)');
  assert.strictEqual(closeAudio.audible, true);

  // Son à moyenne distance (ex: dist = 6.0)
  const midAudio = SoundManager.calculateSpatialAudio(6.0, 0, 0, 0, 0, { refDistance: 1.2, maxDistance: 15 });
  assert.ok(midAudio.attenuation > 0 && midAudio.attenuation < 1.0, `Atténuation moyenne distance progressive: ${midAudio.attenuation}`);

  // Son hors de portée maximale (ex: dist = 25 > maxDistance 15)
  const farAudio = SoundManager.calculateSpatialAudio(25.0, 0, 0, 0, 0, { refDistance: 1.2, maxDistance: 15 });
  assert.strictEqual(farAudio.audible, false, 'Son hors de portée doit être inaudible');
  assert.strictEqual(farAudio.attenuation, 0);
  console.log('   ✅ Atténuation inverse et coupure hors de portée validées.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DU SOUNDMANAGER ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erreur lors du test :', err);
  process.exit(1);
});
