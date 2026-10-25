import { ItemDatabase } from '../config/ItemDatabase';
import type { EquipmentItem, EquipmentSlot } from '../types';

export class StashManager {
  private static readonly STORAGE_KEY = 'raycaster_stash';
  private static stashItems: EquipmentItem[] = [];
  private static isInitialized = false;

  public static init(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        this.stashItems = ids
          .map((id) => ItemDatabase.getItemById(id))
          .filter((item): item is EquipmentItem => item !== undefined);
      } else {
        // Objets initiaux de réserve
        const starterItem1 = ItemDatabase.getItemById('armor_moldy_hermit_rags');
        const starterItem2 = ItemDatabase.getItemById('hat_leech_infested_mitre');
        this.stashItems = [starterItem1, starterItem2].filter(
          (i): i is EquipmentItem => i !== undefined
        );
        this.save();
      }
    } catch (err) {
      console.warn('Impossible de charger la réserve d’objets :', err);
    }

    this.isInitialized = true;
  }

  public static getStash(): readonly EquipmentItem[] {
    this.init();
    return this.stashItems;
  }

  public static addItem(item: EquipmentItem): void {
    this.init();
    this.stashItems.push(item);
    this.save();
  }

  public static removeItem(itemId: string): EquipmentItem | null {
    this.init();
    const index = this.stashItems.findIndex((it) => it.id === itemId);
    if (index >= 0) {
      const removed = this.stashItems.splice(index, 1)[0];
      this.save();
      return removed;
    }
    return null;
  }

  public static hasItemForSlot(slot: EquipmentSlot): boolean {
    this.init();
    return this.stashItems.some((it) => it.slot === slot);
  }

  private static save(): void {
    try {
      const ids = this.stashItems.map((item) => item.id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ids));
    } catch (err) {
      console.warn('Impossible de sauvegarder la réserve d’objets :', err);
    }
  }
}
