import assert from 'assert';
import fs from 'fs';
import { AuthManager } from '../src/core/AuthManager';
import { WalletManager } from '../src/core/WalletManager';
import { StashManager } from '../src/core/StashManager';
import { Inventory } from '../src/entities/Inventory';
import { QuestManager } from '../src/core/QuestManager';
import { AuthModal } from '../src/ui/AuthModal';
import type { AuthUser } from '../src/types/auth';

// Setup Mock DOM minimaliste pour Node.js
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (typeof (globalThis as any).document === 'undefined') {
  const elements = new Map<string, any>();
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (!elements.has(id)) {
        const classSet = new Set<string>();
        if (id === 'auth-modal') classSet.add('hidden');
        elements.set(id, {
          id,
          style: { display: '' },
          textContent: '',
          value: '',
          classList: {
            add: (c: string) => classSet.add(c),
            remove: (c: string) => classSet.delete(c),
            contains: (c: string) => classSet.has(c),
          },
          addEventListener: () => {},
          removeEventListener: () => {},
          focus: () => {},
        });
      }
      return elements.get(id);
    },
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
  if (mockFetchResponses.has(urlStr)) {
    const handler = mockFetchResponses.get(urlStr);
    return typeof handler === 'function' ? handler(init) : handler;
  }
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Route non trouvée' }),
  };
};

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires du Système d\'Authentification & Mode Invité...\n');

  console.log('1. Test de l\'état initial (Mode Invité)...');
  localStorage.clear();
  const testInventory = new Inventory();
  await AuthManager.init(testInventory);

  assert.strictEqual(AuthManager.isLoggedIn(), false, 'Le joueur doit être considéré comme invité au départ');
  assert.strictEqual(AuthManager.getUser(), null, 'Aucun utilisateur connecté initialement');
  assert.strictEqual(AuthManager.getToken(), null, 'Aucun token de session initialement');
  console.log('   ✅ Mode Invité actif par défaut.');

  console.log('2. Test de non-persistance en Mode Invité (AuthManager.syncPlayer)...');
  const syncResultGuest = await AuthManager.syncPlayer({ coins: 500 });
  assert.strictEqual(
    syncResultGuest,
    false,
    'En mode invité, syncPlayer doit renvoyer false sans contacter la base de données'
  );
  console.log('   ✅ En Mode Invité, aucune persistance distante n\'est envoyée.');

  console.log('3. Test des validations côté client (AuthManager.register & login)...');
  const regShortUser = await AuthManager.register('ab', 'password123');
  assert.strictEqual(regShortUser.success, false);
  assert.ok(regShortUser.error?.includes('3 caractères'));

  const regBadChars = await AuthManager.register('Dark Knight!', 'password123');
  assert.strictEqual(regBadChars.success, false);
  assert.ok(regBadChars.error?.includes('lettres, chiffres'));

  const regShortPass = await AuthManager.register('DarkKnight', '12345');
  assert.strictEqual(regShortPass.success, false);
  assert.ok(regShortPass.error?.includes('6 caractères'));

  const logEmpty = await AuthManager.login('', '');
  assert.strictEqual(logEmpty.success, false);
  console.log('   ✅ Validations client strictes conformes.');

  console.log('4. Test de notification des observateurs (AuthManager.subscribe)...');
  let notifiedUser: AuthUser | null = undefined as any;
  const unsubscribe = AuthManager.subscribe((u) => {
    notifiedUser = u;
  });
  assert.strictEqual(notifiedUser, null, 'Doit notifier avec null au début');

  console.log('5. Test de connexion réussie et synchronisation de l\'état joueur...');
  const fakeToken = 'test_token_abc_123';
  const fakeUser: AuthUser = { id: 'usr-1234', username: 'TestKnight' };

  mockFetchResponses.set('/api/auth/login', (init: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: fakeToken,
        user: fakeUser,
        profile: { coins: 350, level: 2 },
        inventory: {
          equipped: {
            weapon: { id: 'starter_wand', name: 'Baguette d\'apprenti', slot: 'weapon', rarity: 'common' },
          },
          stash: [],
        },
        quests: { kills: { current: 4, claimed: false } },
      }),
    };
  });

  const loginRes = await AuthManager.login('TestKnight', 'MySecret123!');
  assert.strictEqual(loginRes.success, true, 'La connexion simulée doit réussir');
  assert.strictEqual(AuthManager.isLoggedIn(), true, 'isLoggedIn doit être true');
  assert.strictEqual(AuthManager.getUser()?.username, 'TestKnight');
  assert.strictEqual(AuthManager.getToken(), fakeToken);
  assert.strictEqual(notifiedUser?.username, 'TestKnight', 'Les observateurs doivent recevoir l\'utilisateur');
  assert.strictEqual(WalletManager.getCoins(), 350, 'Les pièces doivent être mises à jour avec le solde du profil');
  assert.strictEqual(testInventory.hasItem('weapon'), true, 'L\'équipement doit avoir été synchronisé');
  console.log('   ✅ Connexion et application de l\'état joueur réussies.');

  console.log('6. Test de persistance active lorsque connecté (AuthManager.syncPlayer)...');
  let syncPayloadReceived: any = null;
  mockFetchResponses.set('/api/player/sync', (init: any) => {
    syncPayloadReceived = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    };
  });

  const syncSuccess = await AuthManager.syncPlayer({ raidOutcome: 'extracted', coins: 400 });
  assert.strictEqual(syncSuccess, true, 'syncPlayer doit réussir pour un utilisateur connecté');
  assert.strictEqual(syncPayloadReceived.raidOutcome, 'extracted');
  assert.strictEqual(syncPayloadReceived.coins, 400);
  assert.ok(syncPayloadReceived.equipped.weapon, 'L\'arme équipée doit être incluse dans le payload');
  console.log('   ✅ Sauvegarde distante active et fonctionnelle pour le joueur connecté.');

  console.log('7. Test de déconnexion et réinitialisation de l\'état...');
  mockFetchResponses.set('/api/auth/logout', () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  }));

  await AuthManager.logout();
  assert.strictEqual(AuthManager.isLoggedIn(), false, 'Après déconnexion, l\'utilisateur n\'est plus connecté');
  assert.strictEqual(AuthManager.getUser(), null);
  assert.strictEqual(AuthManager.getToken(), null);
  assert.strictEqual(notifiedUser, null, 'Les observateurs doivent recevoir null');
  assert.strictEqual(testInventory.hasItem('weapon'), false, 'L\'inventaire joueur doit être vidé');
  assert.strictEqual(WalletManager.getCoins(), 0, 'Les pièces doivent être réinitialisées en mode invité');
  console.log('   ✅ Déconnexion et nettoyage de session validés.');

  unsubscribe();

  console.log('8. Test de visibilité du modal d\'authentification (AuthModal & Z-Index)...');
  // Vérification de la position dans index.html (auth-modal doit être après main-menu pour le stacking context)
  const htmlContent = fs.readFileSync('index.html', 'utf-8');
  const mainMenuPos = htmlContent.indexOf('id="main-menu"');
  const authModalPos = htmlContent.indexOf('id="auth-modal"');
  assert.ok(mainMenuPos !== -1, 'id="main-menu" doit être présent dans index.html');
  assert.ok(authModalPos !== -1, 'id="auth-modal" doit être présent dans index.html');
  assert.ok(authModalPos > mainMenuPos, 'id="auth-modal" doit être après id="main-menu" dans le DOM');

  // Vérification de la règle CSS z-index
  const cssContent = fs.readFileSync('src/style.css', 'utf-8');
  assert.ok(cssContent.includes('#auth-modal {'), '#auth-modal doit avoir sa règle CSS dédiée');
  assert.ok(
    cssContent.includes('z-index: 1000') || cssContent.includes('z-index: 200'),
    '#auth-modal doit avoir un z-index élevé supérieur à .main-menu (100)'
  );

  // Instanciation et test des méthodes show() et hide()
  const modal = new AuthModal();
  modal.show('login');
  assert.strictEqual(modal.isOpen(), true, 'Le modal doit être ouvert après show()');
  const modalEl = (globalThis as any).document.getElementById('auth-modal');
  assert.strictEqual(modalEl?.style.display, 'flex', 'Le modal doit avoir display: flex après show()');
  assert.strictEqual(modalEl?.classList.contains('hidden'), false, 'Le modal ne doit plus avoir la classe hidden');

  modal.hide();
  assert.strictEqual(modal.isOpen(), false, 'Le modal doit être fermé après hide()');
  assert.strictEqual(modalEl?.style.display, 'none', 'Le modal doit avoir display: none après hide()');
  assert.strictEqual(modalEl?.classList.contains('hidden'), true, 'Le modal doit avoir la classe hidden après hide()');
  console.log('   ✅ Modal d\'authentification visible, prioritaire sur le menu principal (Z-Index) et fonctionnel.');
  console.log('\n✨ TOUS LES TESTS D\'AUTHENTIFICATION ET MODE INVITÉ ONT RÉUSSI AVEC SUCCÈS ! ✨\n');
}

runTests().catch((err) => {
  console.error('❌ Échec du test:', err);
  process.exit(1);
});
