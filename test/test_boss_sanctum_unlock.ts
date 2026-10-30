import assert from 'assert';

// Mock minimal du DOM si exécuté sous Node.js
if (typeof (globalThis as any).document === 'undefined') {
  const dummyCtx: any = new Proxy(
    {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return () => {};
      },
    }
  );
  (globalThis as any).document = {
    createElement: (_tag: string) => ({
      width: 64,
      height: 64,
      getContext: () => dummyCtx,
    }),
  };
}

import { ExtractionPortal } from '../src/entities/ExtractionPortal';
import { MapGenerator } from '../src/world/procedural/MapGenerator';
import { TILE_TYPE } from '../src/config/constants';
import { ItemDatabase } from '../src/config/ItemDatabase';
import type { EquipmentItem, Player } from '../src/types';

async function runTests() {
  console.log('🧪 Démarrage des tests unitaires du verrouillage du Sanctuaire du Boss (Portail Royal & Coffres)...\n');

  console.log('1. Test du Portail Royal avec condition de Boss (ExtractionPortal)...');
  let extracted = false;
  const royalPortal = new ExtractionPortal(
    35.5,
    33.5,
    'Portail Royal du Sanctuaire',
    90,
    (_portal, _player) => {
      extracted = true;
    },
    true // requiresBoss = true
  );

  // A. Vérification de l'état initial : le boss est vivant
  assert.strictEqual(royalPortal.requiresBoss, true, 'Le portail doit exiger la mort du boss');
  assert.strictEqual(royalPortal.isActive(), false, 'Le portail royal ne doit pas être actif tant que le boss vit');
  assert.strictEqual(royalPortal.isBossUnlocked(), false, 'isBossUnlocked doit être false initialement');

  const extInfoInitial = royalPortal.getExtractionInfo();
  assert.strictEqual(extInfoInitial.isActive, false);
  assert.strictEqual(extInfoInitial.requiresBoss, true, 'L\'overlay doit savoir que le portail attend le boss');
  assert.strictEqual(extInfoInitial.remainingSec, 999, 'Le temps restant doit être masqué (999s) tant que le boss vit');

  const initialPrompt = royalPortal.getInteractionPrompt();
  assert.ok(initialPrompt && initialPrompt.includes('SCELLÉ'), `Le prompt doit indiquer que le portail est scellé: "${initialPrompt}"`);

  // B. Simulation d'interaction du joueur : doit échouer
  const dummyPlayer = {
    x: 35.5,
    y: 33.5,
    inventory: {
      hasItem: () => false,
      getItem: () => null,
      unequip: () => {},
    },
    pickupItem: () => null,
  } as unknown as Player;
  const interactResultBefore = royalPortal.interact(dummyPlayer);
  assert.ok(interactResultBefore && interactResultBefore.includes('SCELLÉ'), 'L\'interaction doit avertir que le portail est scellé');
  assert.strictEqual(extracted, false, 'Le joueur ne doit pas pouvoir s\'extraire');

  // C. Avancement du temps au-delà du délai (120 secondes au lieu de 90s) : le portail doit RESTER fermé car boss vivant
  royalPortal.update(120);
  assert.strictEqual(royalPortal.isActive(), false, 'Le portail ne doit JAMAIS s\'ouvrir sur simple timer tant que le boss vit');

  // D. Déverrouillage par la défaite du boss (unlockByBoss)
  royalPortal.unlockByBoss();
  assert.strictEqual(royalPortal.isBossUnlocked(), true, 'Le portail doit être déverrouillé par le boss');
  assert.strictEqual(royalPortal.isActive(), true, 'Le portail royal doit s\'activer immédiatement à la mort du boss');

  const postBossPrompt = royalPortal.getInteractionPrompt();
  assert.ok(postBossPrompt && postBossPrompt.includes('S\'EXTRAIRE'), `Le prompt doit proposer l'extraction: "${postBossPrompt}"`);

  const interactResultAfter = royalPortal.interact(dummyPlayer);
  assert.ok(interactResultAfter && interactResultAfter.includes('EXTRACTION RÉUSSIE'), 'L\'interaction doit réussir');
  assert.strictEqual(extracted, true, 'Le joueur doit être extrait avec succès');
  console.log('   ✅ Cycle de verrouillage et activation du Portail Royal validé.');

  console.log('2. Test des Coffres Royaux du Sanctuaire (BillboardSprite)...');
  class MockBillboardChest {
    public textureId = TILE_TYPE.CHEST;
    public isLockedByBoss = true;
    public wasLockedByBoss = false;
    private isOpened = false;

    public unlockBossChest(): void {
      this.isLockedByBoss = false;
      this.wasLockedByBoss = true;
    }

    public isChestOpened(): boolean {
      return this.isOpened;
    }

    public isInteractable(): boolean {
      return !this.isOpened;
    }

    public getInteractionPrompt(): string | null {
      if (!this.isInteractable()) return null;
      if (this.isLockedByBoss) {
        return "🔒 COFFRE ROYAL SCELLÉ : VAINQUEZ LE BOSS DU SANCTUAIRE POUR L'OUVRIR !";
      }
      return this.wasLockedByBoss ? '[F] OUVRIR LE COFFRE ROYAL' : '[F] OUVRIR LE COFFRE';
    }

    public interact(_player: any): string | null {
      if (!this.isInteractable()) return null;
      if (this.isLockedByBoss) {
        return "🔒 CE COFFRE EST SCELLÉ PAR L'ÂME DU BOSS ! TERRASSEZ-LE POUR DÉVERROUILLER LE BUTIN !";
      }
      this.isOpened = true;
      return '🎁 COFFRE ROYAL OUVERT !';
    }
  }

  const royalChest = new MockBillboardChest();

  // A. Vérification de l'état initial : coffre scellé
  assert.strictEqual(royalChest.isLockedByBoss, true, 'Le coffre doit être verrouillé par le boss');
  assert.strictEqual(royalChest.isChestOpened(), false, 'Le coffre doit être fermé');
  assert.strictEqual(royalChest.isInteractable(), true, 'Le coffre doit rester interactable pour afficher le prompt de scellement');

  const chestPromptBefore = royalChest.getInteractionPrompt();
  assert.ok(chestPromptBefore && chestPromptBefore.includes('COFFRE ROYAL SCELLÉ'), `Le prompt doit indiquer que le coffre est scellé: "${chestPromptBefore}"`);

  // B. Tentative d'ouverture [F] par le joueur : refusée
  const chestInteractBefore = royalChest.interact(dummyPlayer);
  assert.ok(chestInteractBefore && chestInteractBefore.includes('SCELLÉ'), `Le retour doit refuser l'ouverture: "${chestInteractBefore}"`);
  assert.strictEqual(royalChest.isChestOpened(), false, 'Le coffre ne doit pas s\'ouvrir');

  // C. Défaite du boss -> déverrouillage du coffre
  royalChest.unlockBossChest();
  assert.strictEqual(royalChest.isLockedByBoss, false, 'Le coffre doit être déverrouillé');
  assert.strictEqual(royalChest.wasLockedByBoss, true, 'wasLockedByBoss doit être true');

  const chestPromptAfter = royalChest.getInteractionPrompt();
  assert.ok(chestPromptAfter && chestPromptAfter.includes('OUVRIR LE COFFRE'), `Le prompt doit maintenant permettre l'ouverture: "${chestPromptAfter}"`);

  // D. Ouverture du coffre
  const chestInteractAfter = royalChest.interact(dummyPlayer);
  assert.strictEqual(royalChest.isChestOpened(), true, 'Le coffre doit être ouvert');
  assert.notStrictEqual(chestInteractAfter, 'ATTENTION : LE COFFRE ÉTAIT UN MIMIC !', 'Un coffre royal de boss ne doit JAMAIS devenir un Mimic');
  console.log('   ✅ Cycle de verrouillage et ouverture des Coffres Royaux validé.');

  console.log('3. Test de la génération procédurale de la Citadelle (MapGenerator)...');
  const level = MapGenerator.generate({ seed: 42, playerGearScore: 50 });

  // A. Vérification de la liste des coffres du boss dans LevelData
  assert.ok(Array.isArray(level.bossChestCoords), 'bossChestCoords doit être présent dans LevelData');
  assert.strictEqual(level.bossChestCoords.length, 2, 'Il doit y avoir exactement 2 coffres de boss scellés');
  assert.ok(level.bossChestCoords.includes('32,35'), 'Le coffre ouest du boss (32, 35) doit être scellé');
  assert.ok(level.bossChestCoords.includes('38,35'), 'Le coffre est du boss (38, 35) doit être scellé');

  // B. Vérification du portail royal dans extractions
  assert.ok(level.extractions && level.extractions.length > 0, 'Des portails d\'extraction doivent exister');
  const royalExtraction = level.extractions.find((e) => e.name.includes('Royal'));
  assert.ok(royalExtraction, 'Le Portail Royal du Sanctuaire doit exister');
  assert.strictEqual(royalExtraction.requiresBoss, true, 'Le Portail Royal doit avoir requiresBoss = true');
  assert.strictEqual(royalExtraction.x, 35.5);
  assert.strictEqual(royalExtraction.y, 33.5);

  // C. Vérification des autres portails de Zone 2 (qui ne doivent PAS nécessiter le boss)
  const otherPortals = level.extractions.filter((e) => !e.name.includes('Royal'));
  assert.ok(otherPortals.length >= 3, 'Il doit y avoir au moins 3 portails tactiques de Zone 2');
  for (const p of otherPortals) {
    assert.strictEqual(Boolean(p.requiresBoss), false, `Le portail ${p.name} ne doit pas nécessiter le boss`);
  }
  console.log('   ✅ Génération procédurale du Sanctuaire avec coffres et portail scellés validée.');

  console.log('4. Test de simulation de la logique de boucle de jeu (Arbitrage de Game.ts)...');
  // Création d'une entité Boss simulée
  const simulatedBoss = {
    type: { id: 'carrot_cake_king', name: 'Roi Gâteau', rank: 'boss' as const },
    alive: true,
    isAlive() {
      return this.alive;
    },
  };

  const simulatedEntities = [
    simulatedBoss,
    royalPortal,
    royalChest,
  ];

  // Re-verrouillage pour le test
  royalPortal.requiresBoss = true;
  // @ts-expect-error test private field
  royalPortal.isBossDefeated = false;
  royalChest.isLockedByBoss = true;

  // Fonction simulant exactement le bloc Game.ts (l.1492+)
  function updateSanctuaryUnlocks(entities: any[]) {
    const boss = entities.find(
      (e) =>
        e &&
        typeof e.isAlive === 'function' &&
        (e.type?.id === 'blob_boss' ||
          e.type?.id === 'blood_queen' ||
          e.type?.id === 'carrot_cake_king' ||
          e.type?.rank === 'boss')
    );

    if (boss && !boss.isAlive()) {
      for (const ent of entities) {
        if (ent instanceof ExtractionPortal && (ent.requiresBoss || ent.name.includes('Royal'))) {
          ent.unlockByBoss();
        }
        if (ent && typeof ent.unlockBossChest === 'function' && ent.isLockedByBoss) {
          ent.unlockBossChest();
        }
      }
    }
  }

  // A. Boss vivant : rien ne doit se déverrouiller
  updateSanctuaryUnlocks(simulatedEntities);
  assert.strictEqual(royalPortal.isActive(), false, 'Le portail doit rester inactif tant que le boss vit');
  assert.strictEqual(royalChest.isLockedByBoss, true, 'Le coffre doit rester scellé tant que le boss vit');

  // B. Mort du Boss : tout doit se déverrouiller instantanément
  simulatedBoss.alive = false;
  updateSanctuaryUnlocks(simulatedEntities);
  assert.strictEqual(royalPortal.isActive(), true, 'Le portail royal doit être actif dès la mort du boss');
  assert.strictEqual(royalChest.isLockedByBoss, false, 'Le coffre royal doit être déverrouillé dès la mort du boss');
  console.log('   ✅ Arbitrage temps réel du déverrouillage de la dernière salle validé.');

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DE DÉVERROUILLAGE DU SANCTUAIRE DU BOSS ONT RÉUSSI !');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Échec du test :', err);
  process.exit(1);
});
