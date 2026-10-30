import type {
  EquipmentItem,
  ItemRarity,
  ItemStats,
  StatRollRange,
  DifficultyScaling,
  GearScoreDropTier,
  RarityDropRate,
} from '../types';
import type { Player } from '../entities/Player';
import { UpgradeManager } from './UpgradeManager';
import { ItemDatabase } from '../config/ItemDatabase';
import { I18nService, type GearTierKey, type Language } from './I18nService';

const RARITY_BASE_SCORE: Record<ItemRarity, number> = {
  common: 15,
  uncommon: 35,
  rare: 70,
  epic: 120,
  legendary: 190,
  artifact: 280,
};

export const GEAR_SCORE_RARITY_TABLE: readonly GearScoreDropTier[] = [
  {
    minScore: 0,
    maxScore: 149,
    label: 'Débutant',
    rates: {
      common: 92.0,
      uncommon: 7.5,
      rare: 0.5,
      epic: 0.0,
      legendary: 0.0,
      artifact: 0.0,
    },
  },
  {
    minScore: 150,
    maxScore: 299,
    label: 'Novice',
    rates: {
      common: 70.0,
      uncommon: 27.0,
      rare: 2.8,
      epic: 0.2,
      legendary: 0.0,
      artifact: 0.0,
    },
  },
  {
    minScore: 300,
    maxScore: 499,
    label: 'Initié',
    rates: {
      common: 44.0,
      uncommon: 45.0,
      rare: 10.0,
      epic: 0.9,
      legendary: 0.1,
      artifact: 0.0,
    },
  },
  {
    minScore: 500,
    maxScore: 749,
    label: 'Aventurier',
    rates: {
      common: 22.0,
      uncommon: 46.0,
      rare: 26.0,
      epic: 5.4,
      legendary: 0.59,
      artifact: 0.01,
    },
  },
  {
    minScore: 750,
    maxScore: 1049,
    label: 'Vétéran',
    rates: {
      common: 10.0,
      uncommon: 32.0,
      rare: 40.0,
      epic: 16.0,
      legendary: 1.9,
      artifact: 0.1,
    },
  },
  {
    minScore: 1050,
    maxScore: 1449,
    label: 'Champion',
    rates: {
      common: 4.0,
      uncommon: 18.0,
      rare: 40.0,
      epic: 28.0,
      legendary: 9.0,
      artifact: 1.0,
    },
  },
  {
    minScore: 1450,
    maxScore: 1899,
    label: 'Maître',
    rates: {
      common: 1.5,
      uncommon: 8.5,
      rare: 30.0,
      epic: 38.0,
      legendary: 18.0,
      artifact: 4.0,
    },
  },
  {
    minScore: 1900,
    maxScore: Infinity,
    label: 'Légende (Endgame)',
    rates: {
      common: 0.5,
      uncommon: 4.5,
      rare: 20.0,
      epic: 42.0,
      legendary: 26.0,
      artifact: 7.0,
    },
  },
];

export class GearScoreService {
  /**
   * Retourne le rang et la couleur associée à un Gear Score donné.
   * Progression équilibrée basée sur un équipement complet de 4 pièces :
   * - < 150 : Débutant (aucun ou 1-2 items communs)
   * - 150 - 299 : Novice (set commun complet)
   * - 300 - 499 : Initié (set peu commun complet)
   * - 500 - 749 : Aventurier (set rare complet)
   * - 750 - 1049 : Vétéran (set rare avancé / début épique)
   * - 1050 - 1449 : Champion (set épique complet / premières pièces légendaires)
   * - 1450 - 1899 : Maître (set légendaire complet)
   * - 1900+ : Légende (artéfacts et endgame optimisé)
   */
  public static getGearScoreTier(
    gs: number,
    lang?: Language
  ): { label: string; color: string; tierKey: GearTierKey } {
    let tierKey: GearTierKey = 'beginner';
    let color = '#78716c';

    if (gs >= 1900) {
      tierKey = 'legend';
      color = '#ef4444';
    } else if (gs >= 1450) {
      tierKey = 'master';
      color = '#f59e0b';
    } else if (gs >= 1050) {
      tierKey = 'champion';
      color = '#a855f7';
    } else if (gs >= 750) {
      tierKey = 'veteran';
      color = '#8b5cf6';
    } else if (gs >= 500) {
      tierKey = 'adventurer';
      color = '#3b82f6';
    } else if (gs >= 300) {
      tierKey = 'initiate';
      color = '#22c55e';
    } else if (gs >= 150) {
      tierKey = 'novice';
      color = '#94a3b8';
    }

    const label = I18nService.t(`tier.${tierKey}`, undefined, lang);
    return { label, color, tierKey };
  }

  /**
   * Retourne le tableau de progression Gear Score -> Raretés
   */
  public static getRarityProgressionTable(): readonly GearScoreDropTier[] {
    return GEAR_SCORE_RARITY_TABLE;
  }

  /**
   * Calcule les pourcentages exacts de chances de drop par rareté pour un Gear Score donné,
   * avec interpolation continue et scaling infini au-delà de 1900 GS.
   */
  public static getRarityDropRates(
    playerGearScore: number,
    bonusScore: number = 0
  ): RarityDropRate {
    const gs = Math.max(0, playerGearScore + bonusScore);

    // Scaling infini au-delà de 1900 GS
    if (gs >= 1900) {
      const extra1k = (gs - 1900) / 1000;
      const artifact = Math.min(18.0, 7.0 + extra1k * 3.5);
      const legendary = Math.min(35.0, 26.0 + extra1k * 2.5);
      const common = Math.max(0.1, 0.5 - extra1k * 0.1);
      const uncommon = Math.max(0.5, 4.5 - extra1k * 1.0);
      const remainder = 100 - (artifact + legendary + common + uncommon);
      const rare = remainder * 0.35;
      const epic = remainder * 0.65;
      return { common, uncommon, rare, epic, legendary, artifact };
    }

    const anchors = [
      { gs: 50, rates: GEAR_SCORE_RARITY_TABLE[0].rates },
      { gs: 225, rates: GEAR_SCORE_RARITY_TABLE[1].rates },
      { gs: 400, rates: GEAR_SCORE_RARITY_TABLE[2].rates },
      { gs: 625, rates: GEAR_SCORE_RARITY_TABLE[3].rates },
      { gs: 900, rates: GEAR_SCORE_RARITY_TABLE[4].rates },
      { gs: 1250, rates: GEAR_SCORE_RARITY_TABLE[5].rates },
      { gs: 1675, rates: GEAR_SCORE_RARITY_TABLE[6].rates },
      { gs: 1900, rates: GEAR_SCORE_RARITY_TABLE[7].rates },
    ];

    if (gs <= anchors[0].gs) {
      return { ...anchors[0].rates };
    }

    for (let i = 0; i < anchors.length - 1; i++) {
      const a1 = anchors[i];
      const a2 = anchors[i + 1];
      if (gs >= a1.gs && gs <= a2.gs) {
        const t = (gs - a1.gs) / (a2.gs - a1.gs);
        return {
          common: a1.rates.common + (a2.rates.common - a1.rates.common) * t,
          uncommon: a1.rates.uncommon + (a2.rates.uncommon - a1.rates.uncommon) * t,
          rare: a1.rates.rare + (a2.rates.rare - a1.rates.rare) * t,
          epic: a1.rates.epic + (a2.rates.epic - a1.rates.epic) * t,
          legendary: a1.rates.legendary + (a2.rates.legendary - a1.rates.legendary) * t,
          artifact: a1.rates.artifact + (a2.rates.artifact - a1.rates.artifact) * t,
        };
      }
    }

    return { ...anchors[anchors.length - 1].rates };
  }

  /**
   * Tire une rareté d'objet basée sur le Gear Score actuel du joueur
   */
  public static rollRarityForGearScore(
    playerGearScore: number,
    bonusScore: number = 0
  ): ItemRarity {
    const rates = this.getRarityDropRates(playerGearScore, bonusScore);
    const roll = Math.random() * 100;

    let cumulative = 0;
    cumulative += rates.common;
    if (roll < cumulative) return 'common';

    cumulative += rates.uncommon;
    if (roll < cumulative) return 'uncommon';

    cumulative += rates.rare;
    if (roll < cumulative) return 'rare';

    cumulative += rates.epic;
    if (roll < cumulative) return 'epic';

    cumulative += rates.legendary;
    if (roll < cumulative) return 'legendary';

    return 'artifact';
  }

  /**
   * Tire une rareté garantie Rare ou supérieure (Rare, Épique, Légendaire, Artéfact)
   * normalisée selon le Gear Score du joueur (pour le Gobelin au Trésor).
   */
  public static rollGuaranteedRareRarity(
    playerGearScore: number,
    bonusScore: number = 0
  ): ItemRarity {
    const rates = this.getRarityDropRates(playerGearScore, bonusScore);
    const total = rates.rare + rates.epic + rates.legendary + rates.artifact;
    if (total <= 0) return 'rare';

    const roll = Math.random() * total;
    let cumulative = 0;

    cumulative += rates.rare;
    if (roll < cumulative) return 'rare';

    cumulative += rates.epic;
    if (roll < cumulative) return 'epic';

    cumulative += rates.legendary;
    if (roll < cumulative) return 'legendary';

    return 'artifact';
  }
  /**
   * Calcule le score d'équipement intrinsèque d'une pièce d'équipement
   */
  public static calculateItemGearScore(
    item: EquipmentItem | { rarity: ItemRarity; stats: ItemStats }
  ): number {
    const rarityBase = RARITY_BASE_SCORE[item.rarity] ?? 15;
    const stats = item.stats ?? {};

    let statScore = 0;
    if (stats.damage) statScore += stats.damage * 4.0;
    if (stats.defense) statScore += stats.defense * 6.0;
    if (stats.magicPower) statScore += stats.magicPower * 3.5;
    if (stats.maxHealth) {
      statScore += stats.maxHealth > 0 ? stats.maxHealth * 0.8 : stats.maxHealth * 0.4;
    }
    if (stats.moveSpeed) statScore += stats.moveSpeed * 150;
    if (stats.castSpeed) statScore += stats.castSpeed * 120;
    if (stats.stealth) statScore += stats.stealth * 2.0;
    if (stats.charisma) statScore += stats.charisma * 2.0;

    return Math.max(10, Math.round(rarityBase + statScore));
  }

  /**
   * Calcule le Gear Score global du joueur (équipement équipé + niveau de talents)
   */
  public static calculatePlayerGearScore(player: Player): number {
    let totalScore = 0;

    const equipped = player.inventory.getAllEquipped();
    for (const item of equipped) {
      if (item.slot === 'key') continue; // Les clés utilitaires ne comptent pas dans la puissance
      const itemScore = item.gearScore ?? this.calculateItemGearScore(item);
      totalScore += itemScore;
    }

    // Apport des améliorations permanentes du campement
    const upgradeScore =
      UpgradeManager.getLevel('vitality') * 6 +
      UpgradeManager.getLevel('power') * 8 +
      UpgradeManager.getLevel('defense') * 8 +
      UpgradeManager.getLevel('speed') * 6 +
      UpgradeManager.getLevel('casting') * 6;

    totalScore += upgradeScore;

    // Minimum garanti pour un nouveau joueur sans aucun équipement
    return Math.max(30, totalScore);
  }

  /**
   * Génère une instance unique d'un objet avec statistiques aléatoires (roll)
   * proportionnelles au Gear Score actuel du joueur, avec une fourchette (min - max).
   */
  public static rollItem(
    template: EquipmentItem,
    playerGearScore: number
  ): EquipmentItem {
    // Si l'objet est une clé de quête ou un item utilitaire fixe, on ne scale pas
    if (template.slot === 'key' || template.id === 'offhand_homonculus') {
      return {
        ...template,
        gearScore: template.gearScore ?? this.calculateItemGearScore(template),
        instanceId: `${template.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      };
    }

    const baseTemplateScore = this.calculateItemGearScore(template);

    // Score moyen cible pour un emplacement individuel (1/4 du Gear Score total du joueur)
    const averageSlotScore = Math.max(15, Math.round(playerGearScore / 4));

    // Fourchette de roll aléatoire modérée : entre -10% et +15%
    const rollFactor = 0.90 + Math.random() * 0.25;

    // L'objet cible la puissance de son template de base, avec un ajustement modéré selon la puissance du joueur
    // sans jamais s'envoler de façon exponentielle
    const targetScore = Math.max(
      Math.round(baseTemplateScore * 0.85),
      Math.min(
        Math.round(baseTemplateScore * 1.35),
        Math.round(averageSlotScore * rollFactor)
      )
    );

    // Ratio d'échelle borné (entre 0.80 et 1.30 max par rapport aux stats de base du template)
    const scaleFactor = Math.max(
      0.80,
      Math.min(1.30, targetScore / Math.max(15, baseTemplateScore))
    );

    const rolledStats: ItemStats = {};
    const statRanges: Partial<Record<keyof ItemStats, StatRollRange>> = {};

    for (const [keyStr, val] of Object.entries(template.stats)) {
      const key = keyStr as keyof ItemStats;
      if (typeof val !== 'number') continue;

      if (val > 0) {
        if (key === 'moveSpeed' || key === 'castSpeed') {
          // Croissance sous-linéaire modérée pour ne pas casser la physique de marche
          const scaledSpeed = val * Math.pow(scaleFactor, 0.35);
          const minRoll = Number(Math.max(0.05, scaledSpeed * 0.9).toFixed(2));
          const maxRoll = Number((scaledSpeed * 1.1).toFixed(2));
          const roll = Number((minRoll + Math.random() * (maxRoll - minRoll)).toFixed(2));
          rolledStats[key] = roll;
          statRanges[key] = { min: minRoll, max: maxRoll };
        } else {
          // Dégâts, PV, Défense, Puissance Magique...
          const scaledVal = val * scaleFactor;
          const minRoll = Math.max(1, Math.round(scaledVal * 0.88));
          const maxRoll = Math.max(minRoll, Math.round(scaledVal * 1.12));
          const roll = Math.round(minRoll + Math.random() * (maxRoll - minRoll));
          rolledStats[key] = roll;
          statRanges[key] = { min: minRoll, max: maxRoll };
        }
      } else {
        // Garde les malus inchangés
        rolledStats[key] = val;
      }
    }

    const finalGearScore = this.calculateItemGearScore({
      rarity: template.rarity,
      stats: rolledStats,
    });

    const instanceId = `${template.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      ...template,
      instanceId,
      stats: rolledStats,
      gearScore: finalGearScore,
      statRanges,
    };
  }

  /**
   * Assainit une pièce d'équipement : si ses statistiques ou son score dépassent de façon anormale
   * le template d'origine (ex: vestige de l'ancien bug multiplicateur), ils sont recalculés
   * et bornés pour rétablir un équilibre légitime.
   */
  public static sanitizeItem(item: EquipmentItem): EquipmentItem {
    if (!item || !item.id) return item;
    if (item.slot === 'key' || item.id === 'offhand_homonculus') {
      return {
        ...item,
        gearScore: item.gearScore ?? this.calculateItemGearScore(item),
      };
    }

    const template = ItemDatabase.getItemById(item.id);
    if (!template) return item;

    const baseTemplateScore = this.calculateItemGearScore(template);
    const currentScore = item.gearScore ?? this.calculateItemGearScore(item);

    // Si le score actuel dépasse de plus de 45% le score de base du template,
    // l'objet a été corrompu par l'ancien bug de sur-scaling
    if (currentScore > baseTemplateScore * 1.45) {
      return this.rollItem(template, baseTemplateScore * 4);
    }

    return item;
  }

  /**
   * Calcule le scaling continu et infini des monstres et de l'or pour l'expédition
   */
  public static calculateDifficultyScaling(
    playerGearScore: number
  ): DifficultyScaling {
    const gs = Math.max(30, playerGearScore);

    // Multiplicateurs continus doux
    // À 300 GS -> ~2.0x HP, à 600 GS -> ~2.8x HP, à 1200 GS -> ~4.2x HP
    const hpMultiplier = Number((1 + Math.pow(gs / 260, 0.85)).toFixed(2));
    const damageMultiplier = Number((1 + Math.pow(gs / 350, 0.75)).toFixed(2));
    const goldMultiplier = Number((1 + (gs / 300) * 0.6).toFixed(2));

    return {
      playerGearScore: gs,
      hpMultiplier,
      damageMultiplier,
      goldMultiplier,
    };
  }
}
