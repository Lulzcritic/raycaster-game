import assert from 'node:assert';
import { ControlsManager, type KeyboardLayout } from '../src/core/ControlsManager';
import { KEYS } from '../src/config/constants';

console.log('🧪 Démarrage des tests unitaires du Commutateur de Clavier (QWERTY / AZERTY)...\n');

// Mock localStorage pour le test headless Node.js
const mockStorage = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => mockStorage.set(key, String(val)),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
(globalThis as any).localStorage = fakeLocalStorage;
(globalThis as any).window = globalThis;

// 1. Test de l'état par défaut (QWERTY)
console.log('1. Test de la disposition par défaut (QWERTY)...');
ControlsManager.setLayout('qwerty');
assert.strictEqual(ControlsManager.getLayout(), 'qwerty', 'La disposition initiale doit être QWERTY');
assert.strictEqual(KEYS.MOVE_FORWARD, 'w', 'KEYS.MOVE_FORWARD doit être "w" en QWERTY');
assert.strictEqual(KEYS.STRAFE_LEFT, 'a', 'KEYS.STRAFE_LEFT doit être "a" en QWERTY');
assert.strictEqual(KEYS.MOVE_BACKWARD, 's', 'KEYS.MOVE_BACKWARD doit être "s" en QWERTY');
assert.strictEqual(KEYS.STRAFE_RIGHT, 'd', 'KEYS.STRAFE_RIGHT doit être "d" en QWERTY');
assert.strictEqual(KEYS.INTERACT, 'f', 'KEYS.INTERACT doit rester "f"');
assert.strictEqual(KEYS.SHOOT, ' ', 'KEYS.SHOOT doit rester espace');

const qwertyLabels = ControlsManager.getLabels('qwerty');
assert.strictEqual(qwertyLabels.forwardBackward, 'W / S');
assert.strictEqual(qwertyLabels.strafe, 'A / D');
console.log('   ✅ Disposition QWERTY validée (W, A, S, D).');

// 2. Test du basculement vers AZERTY
console.log('2. Test du basculement vers AZERTY (Touches Z, Q, S, D)...');
ControlsManager.setLayout('azerty');
assert.strictEqual(ControlsManager.getLayout(), 'azerty', 'La disposition doit être passée en AZERTY');
assert.strictEqual(KEYS.MOVE_FORWARD, 'z', 'KEYS.MOVE_FORWARD doit être dynamiquement "z" en AZERTY');
assert.strictEqual(KEYS.STRAFE_LEFT, 'q', 'KEYS.STRAFE_LEFT doit être dynamiquement "q" en AZERTY');
assert.strictEqual(KEYS.MOVE_BACKWARD, 's', 'KEYS.MOVE_BACKWARD doit rester "s" en AZERTY');
assert.strictEqual(KEYS.STRAFE_RIGHT, 'd', 'KEYS.STRAFE_RIGHT doit rester "d" en AZERTY');
assert.strictEqual(KEYS.INTERACT, 'f', 'KEYS.INTERACT doit rester "f"');

const azertyLabels = ControlsManager.getLabels('azerty');
assert.strictEqual(azertyLabels.forwardBackward, 'Z / S');
assert.strictEqual(azertyLabels.strafe, 'Q / D');
assert.strictEqual(mockStorage.get('raycaster_keyboard_layout'), 'azerty', 'Le choix AZERTY doit être sauvegardé dans localStorage');
console.log('   ✅ Basculement AZERTY validé (Z, Q, S, D) et persistance localStorage confirmée.');

// 3. Test de toggleLayout (interrupteur alternatif)
console.log('3. Test de la fonction interrupteur toggleLayout()...');
const toggled1 = ControlsManager.toggleLayout();
assert.strictEqual(toggled1, 'qwerty', 'Le toggle depuis AZERTY doit donner QWERTY');
assert.strictEqual(KEYS.MOVE_FORWARD, 'w', 'KEYS.MOVE_FORWARD doit repasser à "w"');

const toggled2 = ControlsManager.toggleLayout();
assert.strictEqual(toggled2, 'azerty', 'Le toggle depuis QWERTY doit donner AZERTY');
assert.strictEqual(KEYS.MOVE_FORWARD, 'z', 'KEYS.MOVE_FORWARD doit repasser à "z"');
console.log('   ✅ Toggle alterné QWERTY <-> AZERTY conforme.');

// 4. Test des observateurs (subscribe / notify)
console.log('4. Test des notifications aux observateurs (synchronisation UI)...');
let observedLayout: KeyboardLayout | null = null;
let notificationCount = 0;

const unsubscribe = ControlsManager.subscribe((layout) => {
  observedLayout = layout;
  notificationCount++;
});

// À l'abonnement, notification immédiate avec la disposition actuelle (azerty)
assert.strictEqual(observedLayout, 'azerty');
assert.strictEqual(notificationCount, 1);

// Changement vers qwerty
ControlsManager.setLayout('qwerty');
assert.strictEqual(observedLayout, 'qwerty');
assert.strictEqual(notificationCount, 2);

// Même valeur : ne doit pas re-notifier inutilement
ControlsManager.setLayout('qwerty');
assert.strictEqual(notificationCount, 2, 'Pas de double notification si la disposition est identique');

// Désabonnement
unsubscribe();
ControlsManager.setLayout('azerty');
assert.strictEqual(notificationCount, 2, 'Ne doit plus être notifié après désabonnement');
console.log('   ✅ Abonnement et synchronisation des observateurs conformes.');

// 5. Test de résilience et valeurs invalides
console.log('5. Test de résilience face aux entrées invalides...');
ControlsManager.setLayout('azerty');
(ControlsManager as any).setLayout('invalid_layout');
assert.strictEqual(ControlsManager.getLayout(), 'azerty', 'Une valeur invalide ne doit pas modifier la disposition');
console.log('   ✅ Protection contre les valeurs invalides validée.');

console.log('\n======================================================');
console.log('🎉 TOUS LES TESTS DU COMMUTATEUR DE CLAVIER ONT RÉUSSI !');
console.log('======================================================\n');
