import assert from 'node:assert';
import { GearScoreService } from '../src/core/GearScoreService';
import { ItemDatabase } from '../src/config/ItemDatabase';
import { I18nService } from '../src/core/I18nService';
import type { EquipmentItem } from '../src/types';

console.log('🧪 Démarrage des tests unitaires du Rééquilibrage du Gear Score & Assainissement...\n');

// 1. Vérification du calcul et du bornage lors du roll d'un objet
console.log('1. Test du roll d\'équipement avec Gear Score élevé (évitement de l\'effet multiplicateur x4)...');
const starterWand = ItemDatabase.getItemById('weapon_splintered_apprentice_wand') || ItemDatabase.getAllItems().find(i => i.slot === 'weapon')!;
assert.ok(starterWand, 'Le template d\'arme doit exister');

const baseScore = GearScoreService.calculateItemGearScore(starterWand);
console.log(`   Template: "${starterWand.name}" | Score de base: ${baseScore}`);

// Simuler un roll avec un joueur à 3500 Gear Score
for (let i = 0; i < 20; i++) {
  const rolled = GearScoreService.rollItem(starterWand, 3500);
  assert.ok(rolled.gearScore, 'L\'objet généré doit avoir un gearScore');
  // Le score d'une pièce individuelle doit rester strictement borné proportionnellement à son template (<= 1.35x + marge d'arrondi)
  assert.ok(
    rolled.gearScore <= Math.round(baseScore * 1.35) + 3,
    `Le score d'une pièce ne doit pas exploser (obtenu: ${rolled.gearScore}, max attendu: ~${Math.round(baseScore * 1.35) + 3})`
  );
  assert.ok(
    rolled.gearScore >= Math.round(baseScore * 0.75) - 3,
    `Le score d'une pièce ne doit pas s'effondrer (obtenu: ${rolled.gearScore})`
  );
}
console.log('   ✅ Le scaling d\'un item individuel reste borné au template et ne copie plus le total 4 slots.');

// 2. Test du mécanisme d'assainissement (sanitizeItem)
console.log('2. Test de l\'assainissement des objets corrompus par l\'ancien bug (sanitizeItem)...');

// Objet corrompu : une robe ou baguette avec 850 Gear Score alors que le template vaut ~48
const corruptedItem: EquipmentItem = {
  ...starterWand,
  gearScore: 850,
  stats: {
    maxHealth: 500,
    speed: 2.5,
  },
};

const sanitized = GearScoreService.sanitizeItem(corruptedItem);
assert.ok(
  sanitized.gearScore! <= Math.round(baseScore * 1.35) + 3,
  `L'objet corrompu doit être assaini et réajusté (obtenu: ${sanitized.gearScore})`
);
console.log(`   Objet corrompu réajusté: 850 GS -> ${sanitized.gearScore} GS`);

// Objet légitime : doit être conservé
const legitItem: EquipmentItem = {
  ...starterWand,
  gearScore: Math.round(baseScore * 1.1),
  stats: { ...starterWand.stats },
};
const legitSanitized = GearScoreService.sanitizeItem(legitItem);
assert.strictEqual(legitSanitized.gearScore, legitItem.gearScore, 'Un objet équilibré ne doit pas être altéré');
console.log('   ✅ Assainissement fonctionnel : objets corrompus corrigés, objets sains préservés.');

// 3. Test de simulation d'extractions successives selon la table de loot réelle
console.log('3. Simulation de 10 extractions successives (progression continue et stable)...');
let currentTotalGS = 0;
const slots = ['weapon', 'armor', 'hat', 'boots'] as const;
let equipped: Partial<Record<typeof slots[number], EquipmentItem>> = {};

for (let extraction = 1; extraction <= 10; extraction++) {
  // Une expédition type : le joueur trouve 2 à 3 objets au total dans les coffres du donjon
  const dropsCount = 2 + Math.floor(Math.random() * 2);
  for (let d = 0; d < dropsCount; d++) {
    const randomSlot = slots[Math.floor(Math.random() * slots.length)];
    const rarity = GearScoreService.rollRarityForGearScore(currentTotalGS);
    const template = ItemDatabase.getRandomItemByRarity(rarity, randomSlot);
    if (template) {
      const rolled = GearScoreService.rollItem(template, currentTotalGS);
      const currentPiece = equipped[randomSlot];
      if (!currentPiece || (rolled.gearScore && currentPiece.gearScore && rolled.gearScore > currentPiece.gearScore)) {
        equipped[randomSlot] = rolled;
      }
    }
  }

  currentTotalGS = Object.values(equipped).reduce((sum, item) => sum + (item?.gearScore || 0), 0);
  console.log(`   Extraction #${extraction}: Gear Score total = ${currentTotalGS}`);

  // Après 4 extractions avec un départ à 0, le score ne doit en aucun cas dépasser 800 GS
  // (alors qu'avec le bug, il atteignait 3510 GS !)
  if (extraction === 4) {
    assert.ok(
      currentTotalGS < 800,
      `Après 4 extractions le GS ne doit pas être démesuré (obtenu: ${currentTotalGS}, attendu: < 800)`
    );
  }
}
// Même après 10 extractions, le score théorique absolu ne peut jamais dépasser le plafond de 4 artéfacts (~2350 GS)
assert.ok(
  currentTotalGS <= 2350,
  `Le Gear Score total maximal ne peut dépasser le plafond légal (obtenu: ${currentTotalGS})`
);
console.log(`   Score final après 10 extractions: ${currentTotalGS} GS (Plafond respecté <= 2350 GS)`);
console.log('   ✅ Progression saine et équilibrée sans emballement exponentiel.');

// 4. Test des paliers de rangs réalistes (getGearScoreTier)
console.log('4. Test des paliers de rangs et correction du rang Champion prématuré...');
assert.strictEqual(
  GearScoreService.getGearScoreTier(0).label,
  'Beginner',
  '0 GS doit être Beginner (EN par défaut)'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(200).label,
  'Novice',
  '200 GS (set commun) doit être Novice'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(350).label,
  'Initiate',
  '350 GS (set peu commun) doit être Initiate'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(582).label,
  'Adventurer',
  '582 GS (set rare / début épique) doit être Adventurer et SURTOUT PAS Champion'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(850).label,
  'Veteran',
  '850 GS (set épique) doit être Veteran'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(1150).label,
  'Champion',
  '1150 GS (full épique / premières pièces légendaires) doit être Champion'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(1550).label,
  'Master',
  '1550 GS (full légendaire) doit être Master'
);
assert.strictEqual(
  GearScoreService.getGearScoreTier(2000).label,
  'Legend',
  '2000 GS (artéfacts) doit être Legend'
);

// Vérification de la localisation FR
I18nService.setLanguage('fr');
assert.strictEqual(GearScoreService.getGearScoreTier(582).label, 'Aventurier', '582 GS en FR doit être Aventurier');
assert.strictEqual(GearScoreService.getGearScoreTier(1150).label, 'Champion', '1150 GS en FR doit être Champion');
I18nService.setLanguage('en'); // Retour à l'anglais par défaut

console.log('   ✅ Rangs calibrés avec succès : 582 GS est désormais un Aventurier (Adventurer), le rang Champion requiert >= 1050 GS.');

console.log('\n======================================================');
console.log('🎉 TOUS LES TESTS DE RÉÉQUILIBRAGE DU GEAR SCORE ONT RÉUSSI !');
console.log('======================================================\n');
