import type { EquipmentItem, EquipmentSlot, ItemRarity } from '../types';
import rawItems from './items.json';

const ITEMS: readonly EquipmentItem[] = rawItems as EquipmentItem[];
const ITEMS_BY_ID = new Map<string, EquipmentItem>(
  ITEMS.map((item) => [item.id, item])
);

export class ItemDatabase {
  public static getAllItems(): readonly EquipmentItem[] {
    return ITEMS;
  }

  /**
   * Retourne la liste des objets pouvant apparaître dans les coffres au trésor.
   * Exclut strictement les clés de quête ainsi que les objets uniques trouvés uniquement seuls au sol (comme l'Homonculus).
   */
  public static getChestLootPool(): readonly EquipmentItem[] {
    return ITEMS.filter(
      (item) => item.slot !== 'key' && item.slot !== 'offhand' && item.id !== 'offhand_homonculus'
    );
  }

  /**
   * Retourne la liste des objets d'équipement de rareté Rare, Épique, Légendaire ou Artéfact.
   * Utilisé notamment comme récompense garantie lors de l'élimination du Gobelin au Trésor.
   */
  public static getRareOrBetterLootPool(): readonly EquipmentItem[] {
    const validRarities = new Set(['rare', 'epic', 'legendary', 'artifact']);
    return ITEMS.filter(
      (item) =>
        validRarities.has(item.rarity) &&
        item.slot !== 'key' &&
        item.slot !== 'offhand' &&
        item.id !== 'offhand_homonculus'
    );
  }

  /**
   * Retourne la liste des pièces d'équipement standard pour une rareté donnée
   * (exclut les clés et l'homonculus).
   */
  public static getItemsByRarity(rarity: ItemRarity): readonly EquipmentItem[] {
    return ITEMS.filter(
      (item) =>
        item.rarity === rarity &&
        item.slot !== 'key' &&
        item.slot !== 'offhand' &&
        item.id !== 'offhand_homonculus'
    );
  }

  /**
   * Sélectionne un objet d'équipement aléatoire pour une rareté donnée,
   * avec filtrage optionnel par emplacement (slot).
   */
  public static getRandomItemByRarity(
    rarity: ItemRarity,
    slotFilter?: EquipmentSlot
  ): EquipmentItem | undefined {
    let pool = this.getItemsByRarity(rarity);
    if (slotFilter) {
      const filtered = pool.filter((item) => item.slot === slotFilter);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (pool.length === 0) {
      pool = this.getChestLootPool();
    }
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public static getItemById(id: string): EquipmentItem | undefined {
    return ITEMS_BY_ID.get(id);
  }

  public static getItemsBySlot(slot: EquipmentSlot): readonly EquipmentItem[] {
    return ITEMS.filter((item) => item.slot === slot);
  }
}
