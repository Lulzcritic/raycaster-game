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

  public static getItemById(id: string): EquipmentItem | undefined {
    return ITEMS_BY_ID.get(id);
  }

  public static getItemsBySlot(slot: EquipmentSlot): readonly EquipmentItem[] {
    return ITEMS.filter((item) => item.slot === slot);
  }
}
