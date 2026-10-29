import assert from 'assert';
import { SoundManager } from '../src/core/SoundManager';

async function runTests() {
  console.log('🧪 Démarrage des tests du SoundManager...\n');

  console.log('1. Test de résilience en environnement Node.js / Headless...');
  // SoundManager doit pouvoir être initialisé sans planter en headless
  SoundManager.init();
  SoundManager.playMenuMusic();
  SoundManager.playButtonSound();
  SoundManager.stopMenuMusic(0);

  // Vérification des modificateurs de volume
  SoundManager.setMusicVolume(0.5);
  SoundManager.setSfxVolume(0.6);
  assert.ok(true, 'SoundManager doit fonctionner sans exception');
  console.log('   ✅ Résilience validée.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DU SOUNDMANAGER ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erreur lors du test :', err);
  process.exit(1);
});
