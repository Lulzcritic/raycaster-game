import { WalletManager } from './WalletManager';

export interface Quest {
  id: string;
  title: string;
  icon: string;
  description: string;
  target: number;
  current: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
}

export class QuestManager {
  private static readonly STORAGE_KEY = 'raycaster_quests';
  private static quests: Quest[] = [
    {
      id: 'kills',
      title: 'Exterminateur de Monstres',
      icon: '🗡️',
      description: 'Éliminez les créatures corrompues qui hantent les couloirs.',
      target: 8,
      current: 0,
      rewardCoins: 30,
      completed: false,
      claimed: false,
    },
    {
      id: 'chests',
      title: 'Pilleur de Tombes',
      icon: '🗝️',
      description: 'Ouvrez les coffres au trésor dissimulés dans le donjon.',
      target: 4,
      current: 0,
      rewardCoins: 25,
      completed: false,
      claimed: false,
    },
    {
      id: 'bosses',
      title: 'Tueur de Souverain',
      icon: '👑',
      description: 'Terrassez un Boss de Sanctuaire (Reine de Sang ou Roi Gâteau).',
      target: 1,
      current: 0,
      rewardCoins: 60,
      completed: false,
      claimed: false,
    },
    {
      id: 'goblins',
      title: 'Intercepteur Cupide',
      icon: '💰',
      description: 'Empêchez un Gobelin au Trésor de fuir en l’éliminant.',
      target: 1,
      current: 0,
      rewardCoins: 35,
      completed: false,
      claimed: false,
    },
    {
      id: 'richExtraction',
      title: 'Grand Évadé',
      icon: '🏆',
      description: 'Réussissez une extraction en sécurisant au moins 25 pièces.',
      target: 1,
      current: 0,
      rewardCoins: 40,
      completed: false,
      claimed: false,
    },
  ];
  private static isInitialized = false;

  public static init(): void {
    if (this.isInitialized) {
      return;
    }
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed: Record<string, { current: number; claimed: boolean }> = JSON.parse(saved);
        for (const q of this.quests) {
          if (parsed[q.id]) {
            q.current = Math.min(q.target, Math.max(0, parsed[q.id].current));
            q.claimed = Boolean(parsed[q.id].claimed);
            q.completed = q.current >= q.target;
          }
        }
      }
    } catch (err) {
      console.warn('Impossible de charger les quêtes :', err);
    }
    this.isInitialized = true;
  }

  public static getQuests(): readonly Quest[] {
    this.init();
    return this.quests;
  }

  public static onEnemyKilled(typeId: string): void {
    this.init();
    this.incrementQuest('kills');

    if (typeId === 'blood_queen' || typeId === 'carrot_cake_king' || typeId === 'blob_boss') {
      this.incrementQuest('bosses');
    }
    if (typeId === 'goblin') {
      this.incrementQuest('goblins');
    }
  }

  public static onChestOpened(): void {
    this.init();
    this.incrementQuest('chests');
  }

  public static onExtraction(sessionCoins: number): void {
    this.init();
    if (sessionCoins >= 25) {
      this.incrementQuest('richExtraction');
    }
  }

  public static claim(questId: string): boolean {
    this.init();
    const q = this.quests.find((item) => item.id === questId);
    if (!q || !q.completed || q.claimed) {
      return false;
    }

    q.claimed = true;
    WalletManager.addCoins(q.rewardCoins);
    this.save();
    return true;
  }

  private static incrementQuest(id: string): void {
    const q = this.quests.find((item) => item.id === id);
    if (!q || q.completed) {
      return;
    }
    q.current = Math.min(q.target, q.current + 1);
    if (q.current >= q.target) {
      q.completed = true;
    }
    this.save();
  }

  private static save(): void {
    try {
      const payload: Record<string, { current: number; claimed: boolean }> = {};
      for (const q of this.quests) {
        payload[q.id] = { current: q.current, claimed: q.claimed };
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Impossible de sauvegarder les quêtes :', err);
    }
  }
}
