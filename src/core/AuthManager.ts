import type { AuthResponse, AuthUser, SyncPlayerDataPayload } from '../types/auth';
import type { Inventory } from '../entities/Inventory';
import { WalletManager } from './WalletManager';
import { StashManager } from './StashManager';
import { QuestManager } from './QuestManager';

export class AuthManager {
  private static readonly TOKEN_KEY = 'raycaster_auth_token';
  private static readonly USER_KEY = 'raycaster_auth_user';

  private static user: AuthUser | null = null;
  private static token: string | null = null;
  private static activeInventory: Inventory | null = null;
  private static isInitialized = false;
  private static subscribers: Array<(user: AuthUser | null) => void> = [];

  public static setActiveInventory(inventory: Inventory): void {
    this.activeInventory = inventory;
  }

  public static async init(inventory?: Inventory): Promise<void> {
    if (inventory) {
      this.activeInventory = inventory;
    }
    if (this.isInitialized) {
      return;
    }

    try {
      this.token = localStorage.getItem(this.TOKEN_KEY);
      const savedUser = localStorage.getItem(this.USER_KEY);
      if (savedUser) {
        this.user = JSON.parse(savedUser) as AuthUser;
      }

      if (this.token) {
        // Vérification de la session auprès du serveur
        const meRes = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (meRes.ok) {
          const meData = (await meRes.json()) as AuthResponse;
          if (meData.success && meData.user) {
            this.user = meData.user;
            localStorage.setItem(this.USER_KEY, JSON.stringify(this.user));

            // Récupération des données complètes du joueur
            await this.refreshPlayerData();
          } else {
            this.clearLocalSession();
          }
        } else if (meRes.status === 401) {
          // Token expiré ou révoqué
          this.clearLocalSession();
        }
      }
    } catch (err: any) {
      console.warn('[AuthManager] Serveur ou base de données non joignable lors de l\'init:', err.message);
    } finally {
      this.isInitialized = true;
      this.notifySubscribers();
    }
  }

  public static isLoggedIn(): boolean {
    return Boolean(this.token && this.user);
  }

  public static getUser(): AuthUser | null {
    return this.user;
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static async register(
    username: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanUser = username?.trim();
    if (!cleanUser || cleanUser.length < 3) {
      return { success: false, error: 'Le pseudonyme doit comporter au moins 3 caractères' };
    }
    if (cleanUser.length > 30) {
      return { success: false, error: 'Le pseudonyme ne peut pas dépasser 30 caractères' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUser)) {
      return {
        success: false,
        error: 'Le pseudonyme ne peut contenir que des lettres, chiffres, tirets et underscores',
      };
    }
    if (!pass || pass.length < 6) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 6 caractères' };
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: pass }),
      });

      const data = (await res.json()) as AuthResponse;
      if (!res.ok || !data.success || !data.token || !data.user) {
        return { success: false, error: data.error || 'Échec de l\'inscription' };
      }

      this.saveSession(data.token, data.user);
      this.applyServerData(data);
      this.notifySubscribers();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Impossible de contacter le serveur : ${err.message || 'Erreur réseau'}`,
      };
    }
  }

  public static async login(
    username: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanUser = username?.trim();
    if (!cleanUser || !pass) {
      return { success: false, error: 'Veuillez saisir votre pseudonyme et mot de passe' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: pass }),
      });

      const data = (await res.json()) as AuthResponse;
      if (!res.ok || !data.success || !data.token || !data.user) {
        return { success: false, error: data.error || 'Pseudonyme ou mot de passe incorrect' };
      }

      this.saveSession(data.token, data.user);
      this.applyServerData(data);
      this.notifySubscribers();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Impossible de contacter le serveur : ${err.message || 'Erreur réseau'}`,
      };
    }
  }

  public static async logout(): Promise<void> {
    if (this.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` },
        });
      } catch {
        // Ignorer les erreurs réseau lors de la déconnexion
      }
    }

    this.clearLocalSession();
    // Réinitialise l'état local en mode Invité
    WalletManager.resetToGuest();
    StashManager.resetToDefault();
    QuestManager.reset();
    if (this.activeInventory) {
      this.activeInventory.clear();
    }
    this.notifySubscribers();
  }

  /**
   * Synchronise l'état du joueur avec PostgreSQL.
   * Si le joueur n'est pas connecté (mode invité), ne fait rien et retourne false.
   */
  public static async syncPlayer(payload?: SyncPlayerDataPayload): Promise<boolean> {
    if (!this.isLoggedIn() || !this.token) {
      return false;
    }

    try {
      const fullPayload: SyncPlayerDataPayload = {
        coins: WalletManager.getCoins(),
        stash: [...StashManager.getStash()],
        equipped: this.activeInventory ? this.activeInventory.getEquippedMap() : undefined,
        quests: QuestManager.getQuestsMap(),
        ...payload,
      };

      const res = await fetch('/api/player/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(fullPayload),
      });

      if (!res.ok) {
        console.warn('[AuthManager] Échec de la synchronisation distante (HTTP', res.status, ')');
        return false;
      }

      return true;
    } catch (err: any) {
      console.warn('[AuthManager] Erreur réseau lors de la synchronisation du joueur :', err.message);
      return false;
    }
  }

  public static async refreshPlayerData(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await fetch('/api/player/data', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.applyServerData(json.data);
        }
      }
    } catch (err: any) {
      console.warn('[AuthManager] Impossible de rafraîchir les données joueur :', err.message);
    }
  }

  private static applyServerData(data: {
    profile?: { coins?: number };
    inventory?: { equipped?: Record<string, any>; stash?: any[] };
    quests?: Record<string, any>;
  }): void {
    if (data.profile && typeof data.profile.coins === 'number') {
      WalletManager.setCoins(data.profile.coins);
    }
    if (data.inventory?.stash && Array.isArray(data.inventory.stash)) {
      StashManager.setStash(data.inventory.stash);
    }
    if (data.inventory?.equipped && this.activeInventory) {
      this.activeInventory.setAllEquipped(data.inventory.equipped);
    }
    if (data.quests) {
      QuestManager.loadQuests(data.quests);
    }
  }

  private static saveSession(token: string, user: AuthUser): void {
    this.token = token;
    this.user = user;
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch {
      // Ignorer les restrictions de stockage local
    }
  }

  private static clearLocalSession(): void {
    this.token = null;
    this.user = null;
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch {
      // Ignorer les restrictions
    }
  }

  public static subscribe(fn: (user: AuthUser | null) => void): () => void {
    this.subscribers.push(fn);
    fn(this.user);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }

  private static notifySubscribers(): void {
    for (const fn of this.subscribers) {
      fn(this.user);
    }
  }
}
