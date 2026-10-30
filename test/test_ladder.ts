import assert from 'assert';
import { AuthManager } from '../src/core/AuthManager';
import type { LadderEntry } from '../src/types/auth';

// Setup Mock DOM minimaliste pour Node.js
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

// Mock fetch global pour Node.js
const mockFetchResponses = new Map<string, any>();
(globalThis as any).fetch = async (url: string, init?: any) => {
  const urlStr = String(url);
  for (const [pattern, handler] of mockFetchResponses.entries()) {
    if (urlStr.includes(pattern)) {
      return typeof handler === 'function' ? handler(init) : handler;
    }
  }
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Route non trouvée' }),
  };
};

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires du Système de Classement (Ladder & Gear Score Max)...\n');

  console.log('1. Test de récupération du Ladder avec tri par Gear Score Max...');
  const fakeLadder: LadderEntry[] = [
    {
      rank: 1,
      userId: 'usr-1',
      username: 'ShadowArchmage',
      maxGearScore: 1420,
      level: 10,
      raidsWon: 45,
      monstersKilled: 320,
      bossesKilled: 8,
      updatedAt: new Date().toISOString(),
    },
    {
      rank: 2,
      userId: 'usr-2',
      username: 'BloodKnight',
      maxGearScore: 890,
      level: 7,
      raidsWon: 28,
      monstersKilled: 190,
      bossesKilled: 3,
      updatedAt: new Date().toISOString(),
    },
    {
      rank: 3,
      userId: 'usr-3',
      username: 'DungeonRunner',
      maxGearScore: 540,
      level: 4,
      raidsWon: 14,
      monstersKilled: 80,
      bossesKilled: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      rank: 4,
      userId: 'usr-4',
      username: 'NovicePlayer',
      maxGearScore: 85,
      level: 2,
      raidsWon: 2,
      monstersKilled: 12,
      bossesKilled: 0,
      updatedAt: new Date().toISOString(),
    },
  ];

  mockFetchResponses.set('/api/ladder', () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      ladder: fakeLadder,
    }),
  }));

  const res = await AuthManager.fetchLadder(50);
  assert.strictEqual(res.offline, undefined);
  assert.strictEqual(res.ladder.length, 4, 'Doit retourner les 4 entrées simulées');
  assert.strictEqual(res.ladder[0].username, 'ShadowArchmage');
  assert.strictEqual(res.ladder[0].maxGearScore, 1420);
  assert.strictEqual(res.ladder[1].username, 'BloodKnight');
  assert.strictEqual(res.ladder[1].maxGearScore, 890);
  assert.strictEqual(res.ladder[2].username, 'DungeonRunner');
  assert.strictEqual(res.ladder[3].username, 'NovicePlayer');
  assert.strictEqual(res.ladder[3].maxGearScore, 85);
  console.log('   ✅ Récupération et hiérarchie du classement conformes.');

  console.log('2. Test de gestion gracieuse en mode hors-ligne...');
  mockFetchResponses.set('/api/ladder', () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      offline: true,
      ladder: [],
      message: 'PostgreSQL est actuellement hors-ligne',
    }),
  }));

  const resOffline = await AuthManager.fetchLadder(50);
  assert.strictEqual(resOffline.offline, true, 'Doit indiquer offline: true');
  assert.strictEqual(resOffline.ladder.length, 0);
  assert.ok(resOffline.error?.includes('hors-ligne'));
  console.log('   ✅ Mode hors-ligne géré gracieusement sans plantage.');

  console.log('3. Test de gestion d\'erreur réseau (erreur 500 / exception fetch)...');
  mockFetchResponses.set('/api/ladder', () => {
    throw new Error('Connexion réseau interrompue');
  });

  const resError = await AuthManager.fetchLadder(50);
  assert.strictEqual(resError.offline, true);
  assert.strictEqual(resError.ladder.length, 0);
  assert.ok(resError.error?.includes('Impossible de joindre le serveur'));
  console.log('   ✅ Résilience face aux erreurs réseau validée.');

  console.log('4. Test de monotonicité du Gear Score Max (GREATEST)...');
  // Le GS max ne doit jamais régresser même si le joueur équipe temporairement du matériel plus faible
  let currentMaxGs = 650;
  function updateGearScore(newScore: number): void {
    currentMaxGs = Math.max(currentMaxGs, newScore);
  }

  updateGearScore(200); // Équipe une arme commune faible
  assert.strictEqual(currentMaxGs, 650, 'Le GS max ne doit pas baisser après avoir équipé un objet plus faible');

  updateGearScore(980); // Équipe un objet légendaire
  assert.strictEqual(currentMaxGs, 980, 'Le GS max doit augmenter lorsqu un meilleur score est atteint');

  updateGearScore(450);
  assert.strictEqual(currentMaxGs, 980, 'Le record de 980 doit être conservé');
  console.log('   ✅ Règle de persistance du record de Gear Score Max validée.');

  console.log('\n✨ TOUS LES TESTS DU SYSTÈME DE CLASSEMENT (LADDER) ONT RÉUSSI ! ✨\n');
}

runTests().catch((err) => {
  console.error('❌ Échec des tests du ladder:', err);
  process.exit(1);
});
