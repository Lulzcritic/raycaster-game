import { ItemDatabase } from '../config/ItemDatabase';
import { GearScoreService } from './GearScoreService';
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
        const rawList: unknown[] = JSON.parse(saved);
        this.stashItems = rawList
          .map((entry) => {
            if (typeof entry === 'string') {
              const template = ItemDatabase.getItemById(entry);
              if (!template) return undefined;
              return {
                ...template,
                gearScore:
                  template.gearScore ??
                  GearScoreService.calculateItemGearScore(template),
              };
            } else if (entry && typeof entry === 'object' && 'id' in entry) {
              const item = entry as EquipmentItem;
              const sanitized = GearScoreService.sanitizeItem(item);
              if (!sanitized.gearScore) {
                sanitized.gearScore = GearScoreService.calculateItemGearScore(sanitized);
              }
              return sanitized;
            }
            return undefined;
          })
          .filter((item): item is EquipmentItem => item !== undefined);
      } else {
        // Objets initiaux de réserve
        const starterItem1 = ItemDatabase.getItemById('armor_moldy_hermit_rags');
        const starterItem2 = ItemDatabase.getItemById('hat_leech_infested_mitre');
        this.stashItems = [starterItem1, starterItem2]
          .filter((i): i is EquipmentItem => i !== undefined)
          .map((it) => ({
            ...it,
            gearScore: it.gearScore ?? GearScoreService.calculateItemGearScore(it),
          }));
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

  public static setStash(items: EquipmentItem[]): void {
    this.init();
    this.stashItems = [...items].map((it) => ({
      ...it,
      gearScore: it.gearScore ?? GearScoreService.calculateItemGearScore(it),
    }));
    this.save();
  }

  public static resetToDefault(): void {
    const starterItem1 = ItemDatabase.getItemById('armor_moldy_hermit_rags');
    const starterItem2 = ItemDatabase.getItemById('hat_leech_infested_mitre');
    this.stashItems = [starterItem1, starterItem2]
      .filter((i): i is EquipmentItem => i !== undefined)
      .map((it) => ({
        ...it,
        gearScore: it.gearScore ?? GearScoreService.calculateItemGearScore(it),
      }));
    this.save();
  }

  public static addItem(item: EquipmentItem): void {
    this.init();
    if (!item.gearScore) {
      item.gearScore = GearScoreService.calculateItemGearScore(item);
    }
    this.stashItems.push(item);
    this.save();
  }

  public static removeItem(itemIdOrInstanceId: string): EquipmentItem | null {
    this.init();
    const index = this.stashItems.findIndex(
      (it) => it.instanceId === itemIdOrInstanceId || it.id === itemIdOrInstanceId
    );
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
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.stashItems));
    } catch (err) {
      console.warn('Impossible de sauvegarder la réserve d’objets :', err);
    }
  }
}
