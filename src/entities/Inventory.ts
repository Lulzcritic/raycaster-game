import type { EquipmentItem, EquipmentSlot, ItemStats } from '../types';
import { ItemDatabase } from '../config/ItemDatabase';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'hat',
  'weapon',
  'armor',
  'boots',
  'key',
  'offhand',
] as const;

export class Inventory {
  private static readonly STORAGE_KEY = 'raycaster_player_equipped';

  private readonly slots = new Map<EquipmentSlot, EquipmentItem | null>([
    ['hat', null],
    ['weapon', null],
    ['armor', null],
    ['boots', null],
    ['key', null],
    ['offhand', null],
  ]);

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Équipe un objet dans le slot correspondant à sa catégorie et retourne l'ancien objet s'il y en avait un
   */
  public equip(item: EquipmentItem): EquipmentItem | null {
    const previousItem = this.slots.get(item.slot) ?? null;
    this.slots.set(item.slot, item);
    this.saveToStorage();
    return previousItem;
  }

  /**
   * Retire l'objet d'un slot donné et le retourne
   */
  public unequip(slot: EquipmentSlot): EquipmentItem | null {
    const item = this.slots.get(slot) ?? null;
    this.slots.set(slot, null);
    this.saveToStorage();
    return item;
  }

  /**
   * Récupère tous les objets actuellement équipés
   */
  public getAllEquipped(): EquipmentItem[] {
    const list: EquipmentItem[] = [];
    for (const item of this.slots.values()) {
      if (item) {
        list.push(item);
      }
    }
    return list;
  }

  /**
   * Récupère l'objet actuellement équipé dans le slot demandé
   */
  public getItem(slot: EquipmentSlot): EquipmentItem | null {
    return this.slots.get(slot) ?? null;
  }

  public hasItem(slot: EquipmentSlot): boolean {
    return this.slots.get(slot) !== null;
  }

  public hasKey(keyId?: string): boolean {
    const item = this.slots.get('key');
    if (!item) {
      return false;
    }
    if (!keyId) {
      return true;
    }
    return item.id === keyId;
  }

  public useKey(keyId?: string): boolean {
    const item = this.slots.get('key');
    if (!item) {
      return false;
    }
    if (keyId && item.id !== keyId) {
      return false;
    }
    this.slots.set('key', null);
    this.saveToStorage();
    return true;
  }

  /**
   * Calcule la somme des caractéristiques de tous les objets équipés
   */
  public getTotalStats(): Required<ItemStats> {
    const totals: Required<ItemStats> = {
      damage: 0,
      defense: 0,
      magicPower: 0,
      maxHealth: 0,
      moveSpeed: 0,
      castSpeed: 0,
      stealth: 0,
      charisma: 0,
    };

    for (const item of this.slots.values()) {
      if (!item) {
        continue;
      }
      totals.damage += item.stats.damage ?? 0;
      totals.defense += item.stats.defense ?? 0;
      totals.magicPower += item.stats.magicPower ?? 0;
      totals.maxHealth += item.stats.maxHealth ?? 0;
      totals.moveSpeed += item.stats.moveSpeed ?? 0;
      totals.castSpeed += item.stats.castSpeed ?? 0;
      totals.stealth += item.stats.stealth ?? 0;
      totals.charisma += item.stats.charisma ?? 0;
    }

    return totals;
  }

  public clear(): void {
    for (const slot of EQUIPMENT_SLOTS) {
      this.slots.set(slot, null);
    }
    this.saveToStorage();
  }

  public saveToStorage(): void {
    try {
      const equipped: Record<string, string> = {};
      for (const [slot, item] of this.slots.entries()) {
        if (item && slot !== 'key' && slot !== 'offhand') {
          equipped[slot] = item.id;
        }
      }
      localStorage.setItem(Inventory.STORAGE_KEY, JSON.stringify(equipped));
    } catch {
      // Ignore storage restrictions
    }
  }

  public loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(Inventory.STORAGE_KEY);
      if (!saved) {
        return;
      }
      const parsed: Record<string, string> = JSON.parse(saved);
      for (const [slot, itemId] of Object.entries(parsed)) {
        const item = ItemDatabase.getItemById(itemId);
        if (item && item.slot === slot) {
          this.slots.set(slot as EquipmentSlot, item);
        }
      }
    } catch {
      // Ignore storage restrictions
    }
  }
}
