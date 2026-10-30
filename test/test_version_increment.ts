import assert from 'node:assert';
import { APP_VERSION, APP_TITLE_WITH_VERSION } from '../src/config/version';
import packageInfo from '../package.json';

console.log('🧪 Démarrage des tests unitaires de la Gestion et Incrémentation de Version...\n');

// 1. Test du format de version
console.log('1. Test de la résolution de version (APP_VERSION & APP_TITLE_WITH_VERSION)...');
assert.ok(APP_VERSION, 'APP_VERSION doit être défini');
assert.match(
  APP_VERSION,
  /^\d+\.\d+\.\d+$/,
  `APP_VERSION doit respecter le format SemVer (reçu: ${APP_VERSION})`
);

assert.strictEqual(
  APP_TITLE_WITH_VERSION,
  `The old citadel • alpha v${APP_VERSION}`,
  'Le titre complet doit contenir "The old citadel • alpha v<version>"'
);
console.log(`   ✅ Version active détectée : v${APP_VERSION}`);
console.log(`   ✅ Libellé pied de page : "${APP_TITLE_WITH_VERSION}"`);

// 2. Test de cohérence avec package.json
console.log('2. Test de cohérence avec package.json...');
assert.strictEqual(
  APP_VERSION,
  packageInfo.version,
  'En local, APP_VERSION doit correspondre à package.json.version'
);
console.log('   ✅ Cohérence package.json validée.');

// 3. Test de simulation de calcul d'incrément (+0.0.1)
console.log('3. Test de l\'algorithme d\'incrément (+0.0.1)...');
function incrementVersion(ver: string): string {
  const parts = ver.split('.');
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '1', 10);
  const patch = parseInt(parts[2] || '0', 10) + 1;
  return `${major}.${minor}.${patch}`;
}

const v1 = '0.1.1';
const v2 = incrementVersion(v1);
assert.strictEqual(v2, '0.1.2', 'L\'incrément de 0.1.1 doit donner 0.1.2 (+0.0.1)');

const v3 = incrementVersion(v2);
assert.strictEqual(v3, '0.1.3', 'L\'incrément de 0.1.2 doit donner 0.1.3 (+0.0.1)');
console.log('   ✅ Algorithme d\'incrémentation de build validé.');

console.log('\n======================================================');
console.log('🎉 TOUS LES TESTS DE GESTION DE VERSION ONT RÉUSSI !');
console.log('======================================================\n');
