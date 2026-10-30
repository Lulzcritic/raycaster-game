import assert from 'assert';
import { AuthService } from '../server/src/db/AuthService';
import { Database } from '../server/src/db/Database';

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires de la Couche Base de Données & Authentification...\n');

  console.log('1. Test de validation des pseudonymes (AuthService.validateUsername)...');
  const validUser1 = AuthService.validateUsername('ShadowHunter');
  const validUser2 = AuthService.validateUsername('hero_42-fr');
  const emptyUser = AuthService.validateUsername('');
  const shortUser = AuthService.validateUsername('ab');
  const longUser = AuthService.validateUsername('a'.repeat(31));
  const specialUser = AuthService.validateUsername('bad player!');
  const sqlInjUser = AuthService.validateUsername('admin; DROP TABLE users;--');

  assert.strictEqual(validUser1.valid, true, 'ShadowHunter doit être valide');
  assert.strictEqual(validUser2.valid, true, 'hero_42-fr doit être valide');
  assert.strictEqual(emptyUser.valid, false, 'Pseudo vide doit être rejeté');
  assert.strictEqual(shortUser.valid, false, 'Pseudo trop court (<3) doit être rejeté');
  assert.strictEqual(longUser.valid, false, 'Pseudo trop long (>30) doit être rejeté');
  assert.strictEqual(specialUser.valid, false, 'Espaces et points d exclamation doivent être rejetés');
  assert.strictEqual(sqlInjUser.valid, false, 'Tentative d injection de caractères spéciaux doit être rejetée');
  console.log('   ✅ Validation des pseudonymes conforme.');

  console.log('2. Test de validation des mots de passe (AuthService.validatePassword)...');
  const validPass = AuthService.validatePassword('MotDePasse123!');
  const shortPass = AuthService.validatePassword('12345');
  const emptyPass = AuthService.validatePassword('');

  assert.strictEqual(validPass.valid, true, 'Mot de passe robuste doit être valide');
  assert.strictEqual(shortPass.valid, false, 'Mot de passe < 6 caractères doit être rejeté');
  assert.strictEqual(emptyPass.valid, false, 'Mot de passe vide doit être rejeté');
  console.log('   ✅ Validation des mots de passe conforme.');

  console.log('3. Test de génération du sel cryptographique (AuthService.generateSalt)...');
  const salt1 = AuthService.generateSalt();
  const salt2 = AuthService.generateSalt();
  assert.strictEqual(typeof salt1, 'string', 'Le sel doit être une chaîne');
  assert.strictEqual(salt1.length, 32, 'Le sel de 16 octets hexadécimaux doit faire 32 caractères');
  assert.notStrictEqual(salt1, salt2, 'Deux sels générés consécutivement doivent être différents');
  console.log('   ✅ Génération du sel aléatoire conforme.');

  console.log('4. Test de hachage et vérification Scrypt (AuthService.hashPassword & verifyPassword)...');
  const passA = 'SuperSecretKey2026!';
  const passB = 'AnotherSecretKey!';
  const salt = AuthService.generateSalt();

  const hashA1 = AuthService.hashPassword(passA, salt);
  const hashA2 = AuthService.hashPassword(passA, salt);
  const hashB = AuthService.hashPassword(passB, salt);

  assert.strictEqual(hashA1, hashA2, 'Le même mot de passe avec le même sel doit donner le même hash');
  assert.notStrictEqual(hashA1, hashB, 'Deux mots de passe différents doivent avoir des hashes différents');
  assert.strictEqual(hashA1.length, 128, 'Le hash Scrypt 64 octets en hex doit faire 128 caractères');

  const matchTrue = AuthService.verifyPassword(passA, salt, hashA1);
  const matchFalse = AuthService.verifyPassword('MauvaisMotDePasse', salt, hashA1);
  const matchCorrupted = AuthService.verifyPassword(passA, salt, 'hash_invalide_non_hex');

  assert.strictEqual(matchTrue, true, 'verifyPassword doit valider le bon mot de passe');
  assert.strictEqual(matchFalse, false, 'verifyPassword doit refuser le mauvais mot de passe');
  assert.strictEqual(matchCorrupted, false, 'verifyPassword doit gérer gracieusement un hash corrompu');
  console.log('   ✅ Sécurité Scrypt et timingSafeEqual validés.');

  console.log('5. Test de génération des jetons de session (AuthService.generateSessionToken)...');
  const token1 = AuthService.generateSessionToken();
  const token2 = AuthService.generateSessionToken();
  assert.strictEqual(typeof token1, 'string');
  assert.strictEqual(token1.length, 64, 'Jeton de 32 octets aléatoires hex doit faire 64 caractères');
  assert.notStrictEqual(token1, token2, 'Les jetons de session doivent être uniques');
  console.log('   ✅ Jetons de session conformes.');

  console.log('6. Test de construction de la chaîne de connexion (Database.getConnectionString)...');
  const defaultUrl = Database.getConnectionString();
  assert.ok(defaultUrl.startsWith('postgresql://'), 'L URL par défaut doit être une URL postgresql://');
  assert.ok(defaultUrl.includes('raycaster'), 'L URL par défaut doit contenir le nom de la base de données raycaster');

  // Test avec override DATABASE_URL
  const oldUrl = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = 'postgresql://custom_user:custom_pass@db.internal:5433/custom_db';
    assert.strictEqual(Database.getConnectionString(), 'postgresql://custom_user:custom_pass@db.internal:5433/custom_db');
  } finally {
    if (oldUrl !== undefined) {
      process.env.DATABASE_URL = oldUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }
  console.log('   ✅ Résolution des chaînes de connexion conforme.');

  console.log('7. Test de résilience hors ligne (Database.init & query)...');
  const isOnline = await Database.init();
  const status = Database.getStatus();
  assert.strictEqual(typeof status.online, 'boolean', 'Le statut doit indiquer si la DB est en ligne');

  if (!isOnline) {
    console.log('   ℹ️ PostgreSQL est actuellement hors-ligne (normal sans daemon Docker actif).');
    let threw = false;
    try {
      await Database.query('SELECT 1');
    } catch (err: any) {
      threw = true;
      assert.ok(
        err.message.includes('pas connectée'),
        'L erreur doit mentionner que la base n est pas connectée'
      );
    }
    assert.strictEqual(threw, true, 'Une requête hors-ligne doit lever une exception explicite');
    console.log('   ✅ Résilience hors ligne et gestion des erreurs validées.');
  } else {
    console.log('   ✅ PostgreSQL est en ligne et accessible.');
  }

  console.log('\n✨ TOUS LES TESTS DE BASE DE DONNÉES ET AUTHENTIFICATION ONT RÉUSSI AVEC SUCCÈS ! ✨\n');
}

runTests().catch((err) => {
  console.error('❌ Échec des tests de base de données:', err);
  process.exit(1);
});
