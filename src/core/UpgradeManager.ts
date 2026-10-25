import type { ItemStats } from '../types';
import { WalletManager } from './WalletManager';

export type UpgradeId = 'vitality' | 'power' | 'defense' | 'speed' | 'casting';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  icon: string;
  description: string;
  statEffect: string;
  maxLevel: number;
  baseCost: number;
  costScale: number;
}

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  vitality: {
    id: 'vitality',
    name: 'Cœur de Titan',
    icon: '💖',
    description: 'Renforce votre endurance vitale de manière permanente.',
    statEffect: '+15 PV Max par niveau',
    maxLevel: 5,
    baseCost: 30,
    costScale: 1.5,
  },
  power: {
    id: 'power',
    name: 'Force Arcanique',
    icon: '🗡️',
    description: 'Augmente les dégâts de vos sorts et boules de feu.',
    statEffect: '+3 Dégâts de base par niveau',
    maxLevel: 5,
    baseCost: 35,
    costScale: 1.55,
  },
  defense: {
    id: 'defense',
    name: 'Cuirasse Runique',
    icon: '🛡️',
    description: 'Réduit les dégâts physiques et magiques subis.',
    statEffect: '+1 Défense brute par niveau',
    maxLevel: 5,
    baseCost: 30,
    costScale: 1.5,
  },
  speed: {
    id: 'speed',
    name: 'Célérité d’Hermès',
    icon: '💨',
    description: 'Accélère votre vitesse de marche et de strafe.',
    statEffect: '+5% Vitesse de déplacement par niveau',
    maxLevel: 5,
    baseCost: 25,
    costScale: 1.45,
  },
  casting: {
    id: 'casting',
    name: 'Afflux Magique',
    icon: '⚡',
    description: 'Diminue le temps de recharge de vos sorts.',
    statEffect: '+8% Vitesse d’incantation par niveau',
    maxLevel: 5,
    baseCost: 30,
    costScale: 1.5,
  },
};

export class UpgradeManager {
  private static readonly STORAGE_KEY = 'raycaster_upgrades';
  private static levels: Record<UpgradeId, number> = {
    vitality: 0,
    power: 0,
    defense: 0,
    speed: 0,
    casting: 0,
  };
  private static isInitialized = false;

  public static init(): void {
    if (this.isInitialized) {
      return;
    }
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(this.levels) as UpgradeId[]) {
          if (typeof parsed[key] === 'number') {
            this.levels[key] = Math.max(0, Math.min(UPGRADE_DEFINITIONS[key].maxLevel, parsed[key]));
          }
        }
      }
    } catch (err) {
      console.warn('Impossible de charger les améliorations :', err);
    }
    this.isInitialized = true;
  }

  public static getLevel(id: UpgradeId): number {
    this.init();
    return this.levels[id] ?? 0;
  }

  public static getCost(id: UpgradeId): number | null {
    this.init();
    const def = UPGRADE_DEFINITIONS[id];
    const current = this.levels[id] ?? 0;
    if (current >= def.maxLevel) {
      return null;
    }
    return Math.round(def.baseCost * Math.pow(def.costScale, current));
  }

  public static buy(id: UpgradeId): boolean {
    this.init();
    const cost = this.getCost(id);
    if (cost === null) {
      return false; // Niveau max atteint
    }

    if (WalletManager.spendCoins(cost)) {
      this.levels[id] = (this.levels[id] ?? 0) + 1;
      this.save();
      return true;
    }

    return false;
  }

  public static getStats(): Required<ItemStats> {
    this.init();
    return {
      maxHealth: this.levels.vitality * 15,
      damage: this.levels.power * 3,
      defense: this.levels.defense * 1,
      moveSpeed: this.levels.speed * 0.05,
      castSpeed: this.levels.casting * 0.08,
      magicPower: this.levels.power * 2,
      stealth: 0,
      charisma: 0,
    };
  }

  private static save(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.levels));
    } catch (err) {
      console.warn('Impossible de sauvegarder les améliorations :', err);
    }
  }
}
