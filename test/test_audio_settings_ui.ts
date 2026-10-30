import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoundManager } from '../src/core/SoundManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires des Boutons de Désactivation Audio dans les Paramètres...\n');

  console.log('1. Vérification des boutons audio dans les Paramètres du Menu Principal (main-menu-settings-view)...');
  assert.ok(
    indexHtml.includes('id="main-settings-music-btn"'),
    'index.html doit contenir le bouton de musique dans les paramètres du menu principal (#main-settings-music-btn)'
  );
  assert.ok(
    indexHtml.includes('id="main-settings-sfx-btn"'),
    'index.html doit contenir le bouton SFX dans les paramètres du menu principal (#main-settings-sfx-btn)'
  );
  assert.ok(
    indexHtml.includes('id="main-audio-indicator"'),
    'index.html doit contenir l\'indicateur d\'état audio dans les paramètres du menu principal (#main-audio-indicator)'
  );
  assert.ok(
    indexHtml.includes('RÉGLAGES AUDIO'),
    'index.html doit afficher l\'en-tête de section "RÉGLAGES AUDIO"'
  );
  console.log('   ✅ Boutons audio et indicateur présents dans la vue Paramètres du Menu Principal.');

  console.log('2. Vérification des boutons audio dans les Paramètres en Jeu (pause-settings-view)...');
  assert.ok(
    indexHtml.includes('id="settings-music-btn"'),
    'index.html doit contenir le bouton de musique dans les paramètres du menu pause (#settings-music-btn)'
  );
  assert.ok(
    indexHtml.includes('id="settings-sfx-btn"'),
    'index.html doit contenir le bouton SFX dans les paramètres du menu pause (#settings-sfx-btn)'
  );
  assert.ok(
    indexHtml.includes('id="pause-audio-indicator"'),
    'index.html doit contenir l\'indicateur audio dans les paramètres du menu pause (#pause-audio-indicator)'
  );
  console.log('   ✅ Boutons audio et indicateur présents dans la vue Paramètres du Menu Pause.');

  console.log('3. Vérification des boutons audio et accès Paramètres dans le Hub (hub-navbar)...');
  assert.ok(
    indexHtml.includes('id="hub-music-btn"'),
    'index.html doit contenir le raccourci audio musique dans le Hub (#hub-music-btn)'
  );
  assert.ok(
    indexHtml.includes('id="hub-sfx-btn"'),
    'index.html doit contenir le raccourci audio SFX dans le Hub (#hub-sfx-btn)'
  );
  assert.ok(
    indexHtml.includes('id="hub-btn-settings"'),
    'index.html doit contenir le bouton d\'ouverture des paramètres dans le Hub (#hub-btn-settings)'
  );
  console.log('   ✅ Contrôles audio rapides et bouton Paramètres présents dans la barre du Hub.');

  console.log('4. Test de réactivité de SoundManager.subscribeMute()...');
  let notifiedState: { musicMuted: boolean; sfxMuted: boolean } | null = null;
  const unsubscribe = SoundManager.subscribeMute((state) => {
    notifiedState = { ...state };
  });

  // État initial reçu immédiatement
  assert.ok(notifiedState !== null, 'Le listener doit recevoir immédiatement l\'état audio actuel');

  // Test de toggle musique
  SoundManager.setMusicMuted(true);
  assert.strictEqual(notifiedState!.musicMuted, true);
  assert.strictEqual(SoundManager.isMusicMute(), true);

  SoundManager.setMusicMuted(false);
  assert.strictEqual(notifiedState!.musicMuted, false);
  assert.strictEqual(SoundManager.isMusicMute(), false);

  // Test de toggle SFX
  SoundManager.setSfxMuted(true);
  assert.strictEqual(notifiedState!.sfxMuted, true);
  assert.strictEqual(SoundManager.isSfxMute(), true);

  SoundManager.setSfxMuted(false);
  assert.strictEqual(notifiedState!.sfxMuted, false);
  assert.strictEqual(SoundManager.isSfxMute(), false);

  // Test de désabonnement
  unsubscribe();
  const previousState = { ...notifiedState! };
  SoundManager.setMusicMuted(true);
  assert.strictEqual(
    notifiedState!.musicMuted,
    previousState.musicMuted,
    'Après désabonnement, le listener ne doit plus être notifié'
  );

  // Rétablissement
  SoundManager.setMusicMuted(false);
  SoundManager.setSfxMuted(false);
  console.log('   ✅ Système de souscription SoundManager.subscribeMute() validé avec succès.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DES BOUTONS AUDIO DANS LES PARAMÈTRES ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erreur lors du test :', err);
  process.exit(1);
});
