import assert from 'node:assert';
import { I18nService, type Language } from '../src/core/I18nService';
import { UpgradeManager } from '../src/core/UpgradeManager';
import { QuestManager } from '../src/core/QuestManager';
import { GearScoreService } from '../src/core/GearScoreService';
import itemsJson from '../src/config/items.json';

// Minimal localStorage mock for Node environment
class MockLocalStorage {
  private store = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public setItem(key: string, val: string): void {
    this.store.set(key, val);
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
  public clear(): void {
    this.store.clear();
  }
}

// Minimal DOM Element mock for translateDOM test
class MockElement {
  public attributes = new Map<string, string>();
  public textContent = '';
  public innerHTML = '';
  public title = '';
  public placeholder = '';
  public children: MockElement[] = [];

  constructor(public tagName = 'div') {}

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public setAttribute(name: string, val: string): void {
    this.attributes.set(name, val);
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (el: MockElement) => {
      if (selector === '[data-i18n]' && el.attributes.has('data-i18n')) results.push(el);
      else if (selector === '[data-i18n-title]' && el.attributes.has('data-i18n-title')) results.push(el);
      else if (selector === '[data-i18n-placeholder]' && el.attributes.has('data-i18n-placeholder')) results.push(el);
      else if (selector === '[data-i18n-html]' && el.attributes.has('data-i18n-html')) results.push(el);
      for (const child of el.children) check(child);
    };
    for (const child of this.children) check(child);
    return results;
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Démarrage des tests unitaires du Système de Traduction & Internationalisation (i18n)...\n');

  // Setup mock environment
  const mockStorage = new MockLocalStorage();
  (globalThis as any).localStorage = mockStorage;
  (globalThis as any).window = globalThis;
  (globalThis as any).document = {
    documentElement: { lang: 'en' },
    querySelectorAll: () => [],
  };

  // =========================================================================
  // 1. Test du langage par défaut (English / en)
  // =========================================================================
  console.log('1. Test de la langue par défaut (Anglais / en)...');
  mockStorage.clear();
  (I18nService as any).currentLanguage = undefined;
  (I18nService as any).initialized = false;

  const defaultLang = I18nService.getCurrentLanguage();
  assert.strictEqual(defaultLang, 'en', 'La langue par défaut doit être l\'anglais ("en") si aucun choix stocké');
  console.log('   ✅ Langue par défaut confirmée : "en" (English).');

  // =========================================================================
  // 2. Test de commutation et persistance (localStorage)
  // =========================================================================
  console.log('2. Test de changement de langue et persistance (setLanguage & localStorage)...');
  I18nService.setLanguage('fr');
  assert.strictEqual(I18nService.getCurrentLanguage(), 'fr', 'La langue active doit passer à "fr"');
  assert.strictEqual(mockStorage.getItem('raycaster_language'), 'fr', 'Le choix doit être persisté dans localStorage');

  I18nService.setLanguage('en');
  assert.strictEqual(I18nService.getCurrentLanguage(), 'en', 'La langue active doit repasser à "en"');
  assert.strictEqual(mockStorage.getItem('raycaster_language'), 'en', 'Le choix "en" doit être persisté dans localStorage');

  // Toggle alterné
  const toggledToFr = I18nService.toggleLanguage();
  assert.strictEqual(toggledToFr, 'fr');
  assert.strictEqual(I18nService.getCurrentLanguage(), 'fr');

  const toggledToEn = I18nService.toggleLanguage();
  assert.strictEqual(toggledToEn, 'en');
  assert.strictEqual(I18nService.getCurrentLanguage(), 'en');
  console.log('   ✅ Commutation et persistance localStorage validées.');

  // =========================================================================
  // 3. Test des traductions de base (I18nService.t)
  // =========================================================================
  console.log('3. Test des traductions de base (Menu, Paramètres, Audio, Slots, Raretés)...');
  I18nService.setLanguage('en');
  assert.strictEqual(I18nService.t('btn.play'), 'PLAY');
  assert.strictEqual(I18nService.t('btn.resume'), 'RESUME');
  assert.strictEqual(I18nService.t('btn.menu'), 'MAIN MENU');
  assert.strictEqual(I18nService.t('btn.menu_title'), 'Back to main menu');
  assert.strictEqual(I18nService.t('settings.title'), 'SETTINGS');
  assert.strictEqual(I18nService.t('slot.weapon'), 'WEAPON');
  assert.strictEqual(I18nService.t('rarity.legendary'), 'LEGENDARY');
  assert.strictEqual(I18nService.t('tier.veteran'), 'Veteran');

  I18nService.setLanguage('fr');
  assert.strictEqual(I18nService.t('btn.play'), 'JOUER');
  assert.strictEqual(I18nService.t('btn.resume'), 'REPRENDRE');
  assert.strictEqual(I18nService.t('btn.menu'), 'MENU PRINCIPAL');
  assert.strictEqual(I18nService.t('btn.menu_title'), 'Retour au menu principal');
  assert.strictEqual(I18nService.t('settings.title'), 'PARAMÈTRES');
  assert.strictEqual(I18nService.t('slot.weapon'), 'ARME');
  assert.strictEqual(I18nService.t('rarity.legendary'), 'LÉGENDAIRE');
  assert.strictEqual(I18nService.t('tier.veteran'), 'Vétéran');

  // Interpolation de variables {count}, etc.
  I18nService.setLanguage('en');
  assert.strictEqual(I18nService.t('queue.ready_count', { count: 3 }), '3 / 4 READY');
  I18nService.setLanguage('fr');
  assert.strictEqual(I18nService.t('queue.ready_count', { count: 3 }), '3 / 4 PRÊTS');
  console.log('   ✅ Dictionnaires bilingues et interpolations validés.');

  // =========================================================================
  // 4. Test de traduction intégrale des objets du jeu (items.json)
  // =========================================================================
  console.log('4. Test de traduction des 27 objets du catalogue d\'équipements...');
  const itemsList: any[] = Array.isArray(itemsJson) ? itemsJson : (itemsJson as any).items;
  assert.ok(itemsList && itemsList.length >= 25, 'Le catalogue doit contenir au moins 25 objets');

  I18nService.setLanguage('en');
  for (const item of itemsList) {
    const enTrans = I18nService.getItemTranslation(item as any);
    assert.ok(enTrans.name && enTrans.name.length > 0, `Nom anglais manquant pour l'item ${item.id}`);
    assert.ok(enTrans.description && enTrans.description.length > 0, `Description lore anglaise manquante pour l'item ${item.id}`);
  }

  I18nService.setLanguage('fr');
  for (const item of itemsList) {
    const frTrans = I18nService.getItemTranslation(item as any);
    assert.ok(frTrans.name && frTrans.name.length > 0, `Nom français manquant pour l'item ${item.id}`);
    assert.ok(frTrans.description && frTrans.description.length > 0, `Description lore française manquante pour l'item ${item.id}`);
  }
  console.log(`   ✅ 100% des ${itemsList.length} objets possèdent une traduction anglaise et française complète.`);

  // =========================================================================
  // 5. Test des talents/améliorations (UpgradeManager) et quêtes (QuestManager)
  // =========================================================================
  console.log('5. Test de localisation des améliorations et quêtes...');
  I18nService.setLanguage('en');
  const enVitality = UpgradeManager.getUpgradeLocalized('vitality');
  assert.strictEqual(enVitality.name, 'Titan Heart');
  assert.ok(enVitality.description.includes('vital endurance'));

  I18nService.setLanguage('fr');
  const frVitality = UpgradeManager.getUpgradeLocalized('vitality');
  assert.strictEqual(frVitality.name, 'Cœur de Titan');
  assert.ok(frVitality.description.includes('endurance vitale'));

  const testQuest = {
    id: 'chests',
    title: 'Pilleur de Tombes',
    description: 'Ouvrez les coffres au trésor dissimulés dans le donjon.',
    current: 1,
    target: 3,
    icon: '📦',
    rewardCoins: 50,
    completed: false,
    claimed: false,
  };
  I18nService.setLanguage('en');
  const enQuest = QuestManager.getQuestLocalized(testQuest);
  assert.strictEqual(enQuest.title, 'Tomb Raider');
  assert.ok(enQuest.description.includes('Open treasure chests'));

  I18nService.setLanguage('fr');
  const frQuest = QuestManager.getQuestLocalized(testQuest);
  assert.strictEqual(frQuest.title, 'Pilleur de Tombes');
  console.log('   ✅ Améliorations et quêtes localisées avec succès.');

  // =========================================================================
  // 6. Test du moteur DOM translateDOM()
  // =========================================================================
  console.log('6. Test du moteur de traduction DOM (translateDOM)...');
  const root = new MockElement('div');
  const btn = new MockElement('button');
  btn.setAttribute('data-i18n', 'btn.settings');
  btn.setAttribute('data-i18n-title', 'btn.settings');
  root.children.push(btn);

  I18nService.setLanguage('en');
  I18nService.translateDOM(root as any);
  assert.strictEqual(btn.textContent, 'SETTINGS');
  assert.strictEqual(btn.title, 'SETTINGS');

  I18nService.setLanguage('fr');
  I18nService.translateDOM(root as any);
  assert.strictEqual(btn.textContent, 'PARAMÈTRES');
  assert.strictEqual(btn.title, 'PARAMÈTRES');
  console.log('   ✅ Moteur DOM translateDOM() validé.');

  // =========================================================================
  // 7. Test de l'Observateur (subscribe & notify)
  // =========================================================================
  console.log('7. Test du pattern Observateur (I18nService.subscribe)...');
  let notifiedLang: Language | null = null;
  const unsub = I18nService.subscribe((lang) => {
    notifiedLang = lang;
  });

  I18nService.setLanguage('en');
  assert.strictEqual(notifiedLang, 'en');

  I18nService.setLanguage('fr');
  assert.strictEqual(notifiedLang, 'fr');

  unsub();
  notifiedLang = null;
  I18nService.setLanguage('en');
  assert.strictEqual(notifiedLang, null, 'Après unsubscribe, le listener ne doit plus être appelé');
  console.log('   ✅ Souscription réactive et désabonnement validés.');

  // Clean state: leave on English default
  I18nService.setLanguage('en');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DU SYSTÈME DE TRADUCTION SONT VALIDÉS !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Échec des tests de traduction:', err);
  process.exit(1);
});
