import assert from 'assert';
import { LoadingScreen } from '../src/ui/LoadingScreen';

// Mock DOM minimaliste pour Node.js
if (typeof (globalThis as any).document === 'undefined') {
  const elements = new Map<string, any>();
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (!elements.has(id)) {
        elements.set(id, {
          style: { width: '0%', opacity: '1', display: 'flex' },
          textContent: '',
          classList: {
            add: () => {},
            remove: () => {},
          },
          remove: () => {},
        });
      }
      return elements.get(id);
    },
  };
}

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires de l\'Écran de chargement (LoadingScreen)...\n');

  console.log('1. Test d\'instanciation singleton...');
  const loader = LoadingScreen.getInstance();
  assert.ok(loader, 'L\'instance de LoadingScreen doit exister');
  console.log('   ✅ Singleton LoadingScreen validé.');

  console.log('2. Test de progression (setProgress)...');
  loader.setProgress(25, 'Chargement des textures...');
  const percentEl = document.getElementById('loading-percent');
  const statusEl = document.getElementById('loading-status');
  const fillEl = document.getElementById('loading-bar-fill');

  assert.strictEqual(percentEl?.textContent, '25%');
  assert.strictEqual(statusEl?.textContent, 'Chargement des textures...');
  assert.strictEqual(fillEl?.style.width, '25%');

  loader.setProgress(75, 'Harmonisation du moteur audio 3D...');
  assert.strictEqual(percentEl?.textContent, '75%');
  assert.strictEqual(fillEl?.style.width, '75%');

  // Doit plafonner à 100%
  loader.setProgress(150);
  assert.strictEqual(percentEl?.textContent, '100%');
  assert.strictEqual(fillEl?.style.width, '100%');
  console.log('   ✅ Mise à jour de la jauge et des statuts validée.');

  console.log('3. Test de finalisation (finish)...');
  await loader.finish();
  assert.strictEqual(percentEl?.textContent, '100%');
  assert.strictEqual(statusEl?.textContent, 'Prêt pour l\'expédition !');
  console.log('   ✅ Transition de fin et nettoyage validés.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DE L\'ÉCRAN DE CHARGEMENT ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Erreur lors du test :', err);
  process.exit(1);
});
