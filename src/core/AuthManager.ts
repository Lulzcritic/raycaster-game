import type { AuthResponse, AuthUser, LadderEntry, LadderResponse, SyncPlayerDataPayload } from '../types/auth';
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

  public static getApiUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const envApi = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) as string | undefined;
    if (envApi) {
      const base = envApi.endsWith('/') ? envApi.slice(0, -1) : envApi;
      return `${base}${cleanEndpoint}`;
    }

    if (typeof window === 'undefined' || !window.location || !window.location.pathname) {
      return cleanEndpoint;
    }

    // Détection du préfixe de sous-chemin (ex: /toc/ ou /toc)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && !pathParts[0].includes('.')) {
      return `/${pathParts[0]}${cleanEndpoint}`;
    }

    return cleanEndpoint;
  }

  private static async fetchJson<T = any>(
    url: string,
    options?: RequestInit,
    fallbackError = 'Erreur de communication avec le serveur'
  ): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
    try {
      const res = await fetch(url, options);

      // Support des mocks de tests où res.text() n'est pas défini
      if (typeof res.text !== 'function' && typeof res.json === 'function') {
        try {
          const parsed = await res.json();
          if (!res.ok) {
            return {
              ok: false,
              status: res.status,
              data: parsed,
              error: parsed?.error || parsed?.message || fallbackError,
            };
          }
          return { ok: true, status: res.status, data: parsed as T };
        } catch {
          return { ok: false, status: res.status, data: null, error: fallbackError };
        }
      }

      const text = await res.text();
      let json: any = null;
      if (text && text.trim()) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (!res.ok) {
        const errorMsg =
          json?.error ||
          json?.message ||
          (text && text.length < 200 && !text.includes('<html') ? text.trim() : '') ||
          `Erreur serveur HTTP ${res.status} (${res.statusText || 'Échec'})`;
        return { ok: false, status: res.status, data: json, error: errorMsg };
      }

      if (json === null) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'Le serveur a renvoyé une réponse vide ou invalide.',
        };
      }

      return { ok: true, status: res.status, data: json as T };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Impossible de joindre le serveur : ${err.message || 'Erreur réseau'}`,
      };
    }
  }

  public static async requestApi<T = any>(
    endpoint: string,
    options?: RequestInit,
    fallbackError = 'Erreur lors de la requête'
  ): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
    const primaryUrl = this.getApiUrl(endpoint);
    const result = await this.fetchJson<T>(primaryUrl, options, fallbackError);

    // Repli de sécurité : si l'URL préfixée (ex: /toc/api/...) a échoué (404 Not Found ou status 0)
    // et que le chemin était préfixé, on tente l'alternative directe non préfixée (/api/...)
    if (!result.ok && (result.status === 404 || result.status === 0) && primaryUrl !== endpoint) {
      const fallbackResult = await this.fetchJson<T>(endpoint, options, fallbackError);
      if (fallbackResult.ok || fallbackResult.status !== 404) {
        return fallbackResult;
      }
    }

    return result;
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
        const meRes = await this.requestApi<AuthResponse>('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (meRes.ok && meRes.data?.success && meRes.data.user) {
          this.user = meRes.data.user;
          localStorage.setItem(this.USER_KEY, JSON.stringify(this.user));

          // Récupération des données complètes du joueur
          await this.refreshPlayerData();
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
      const res = await this.requestApi<AuthResponse>(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: pass }),
        },
        'Échec de l\'inscription'
      );

      if (!res.ok || !res.data?.success || !res.data.token || !res.data.user) {
        return { success: false, error: res.error || res.data?.error || 'Échec de l\'inscription' };
      }

      this.saveSession(res.data.token, res.data.user);
      this.applyServerData(res.data);
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
      const res = await this.requestApi<AuthResponse>(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: pass }),
        },
        'Pseudonyme ou mot de passe incorrect'
      );

      if (!res.ok || !res.data?.success || !res.data.token || !res.data.user) {
        return { success: false, error: res.error || res.data?.error || 'Pseudonyme ou mot de passe incorrect' };
      }

      this.saveSession(res.data.token, res.data.user);
      this.applyServerData(res.data);
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
        await this.requestApi('/api/auth/logout', {
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

      const res = await this.requestApi('/api/player/sync', {
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
      const res = await this.requestApi<any>('/api/player/data', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok && res.data?.success && res.data.data) {
        this.applyServerData(res.data.data);
      }
    } catch (err: any) {
      console.warn('[AuthManager] Impossible de rafraîchir les données joueur :', err.message);
    }
  }

  /**
   * Récupère le classement officiel des joueurs (Ladder) depuis le serveur.
   */
  public static async fetchLadder(limit = 50): Promise<{ ladder: LadderEntry[]; offline?: boolean; error?: string }> {
    try {
      const res = await this.requestApi<LadderResponse>(`/api/ladder?limit=${encodeURIComponent(limit)}`);
      if (!res.ok || !res.data?.success) {
        return {
          ladder: [],
          offline: true,
          error: res.error || res.data?.error || 'Erreur lors de la récupération du ladder',
        };
      }
      return {
        ladder: res.data.ladder || [],
        offline: res.data.offline,
        error: res.data.offline ? res.data.message : undefined,
      };
    } catch (err: any) {
      return {
        ladder: [],
        offline: true,
        error: `Impossible de joindre le serveur : ${err.message}`,
      };
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
