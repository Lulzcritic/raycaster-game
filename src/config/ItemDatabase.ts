import type { EquipmentItem, EquipmentSlot } from '../types';
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

  public static getItemById(id: string): EquipmentItem | undefined {
    return ITEMS_BY_ID.get(id);
  }

  public static getItemsBySlot(slot: EquipmentSlot): readonly EquipmentItem[] {
    return ITEMS.filter((item) => item.slot === slot);
  }
}
