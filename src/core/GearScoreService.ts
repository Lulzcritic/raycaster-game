import type {
  EquipmentItem,
  ItemRarity,
  ItemStats,
  StatRollRange,
  DifficultyScaling,
} from '../types';
import type { Player } from '../entities/Player';
import { UpgradeManager } from './UpgradeManager';

const RARITY_BASE_SCORE: Record<ItemRarity, number> = {
  common: 15,
  uncommon: 35,
  rare: 70,
  epic: 120,
  legendary: 190,
  artifact: 280,
};

export class GearScoreService {
  /**
   * Calcule le score d'équipement intrinsèque d'une pièce d'équipement
   */
  public static calculateItemGearScore(
    item: EquipmentItem | { rarity: ItemRarity; stats: ItemStats }
  ): number {
    const rarityBase = RARITY_BASE_SCORE[item.rarity] ?? 15;
    const stats = item.stats;

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

    // Fourchette de cible : entre 85% et 125% du Gear Score du joueur
    // Permet de trouver à la fois des objets équivalents et de vrais upgrades puissants (+25%)
    const rollFactor = 0.85 + Math.random() * 0.40;
    const targetScore = Math.max(30, Math.round(playerGearScore * rollFactor));

    // Ratio d'échelle par rapport au template de base
    const scaleFactor = Math.max(0.65, targetScore / Math.max(35, baseTemplateScore));

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
   * Calcule le scaling continu et infini des monstres et de l'or pour l'expédition
   */
  public static calculateDifficultyScaling(
    playerGearScore: number
  ): DifficultyScaling {
    const gs = Math.max(30, playerGearScore);

    // Multiplicateurs continus doux
    // À 120 GS -> ~2.0x HP, à 300 GS -> ~3.2x HP, à 600 GS -> ~4.6x HP
    const hpMultiplier = Number((1 + Math.pow(gs / 120, 0.85)).toFixed(2));
    const damageMultiplier = Number((1 + Math.pow(gs / 180, 0.75)).toFixed(2));
    const goldMultiplier = Number((1 + (gs / 160) * 0.6).toFixed(2));

    return {
      playerGearScore: gs,
      hpMultiplier,
      damageMultiplier,
      goldMultiplier,
    };
  }
}
