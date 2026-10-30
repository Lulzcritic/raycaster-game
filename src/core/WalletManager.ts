/**
 * Gestionnaire du portefeuille et de la persistance de l'argent du joueur.
 * Conserve la somme totale de pièces dans le localStorage pour les achats
 * et améliorations hors-partie, et comptabilise le butin récolté lors de la session.
 */
export class WalletManager {
  private static readonly STORAGE_KEY = 'raycaster_coins';
  private static totalCoins = 0;
  private static sessionCoins = 0;
  private static listeners: Array<(total: number, delta: number) => void> = [];
  private static isInitialized = false;

  public static init(): void {
    if (this.isInitialized) {
      return;
    }
    const saved = localStorage.getItem(this.STORAGE_KEY);
    this.totalCoins = saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    this.sessionCoins = 0;
    this.isInitialized = true;
  }

  /**
   * Retourne la somme totale de pièces possédée (persistante)
   */
  public static getCoins(): number {
    if (!this.isInitialized) {
      this.init();
    }
    return this.totalCoins;
  }

  /**
   * Retourne la quantité de pièces récoltée dans l'expédition actuelle
   */
  public static getSessionCoins(): number {
    return this.sessionCoins;
  }

  /**
   * Réinitialise le compteur de pièces de la session courante (nouveau raid)
   */
  public static resetSessionCoins(): void {
    this.sessionCoins = 0;
  }

  /**
   * Définit directement le montant total de pièces (synchronisation base de données)
   */
  public static setCoins(amount: number): void {
    if (!this.isInitialized) {
      this.init();
    }
    const safeAmount = Math.max(0, Math.floor(amount));
    const delta = safeAmount - this.totalCoins;
    this.totalCoins = safeAmount;
    this.save();
    this.notify(this.totalCoins, delta);
  }

  /**
   * Réinitialise les pièces lors du passage en mode Invité / Déconnexion
   */
  public static resetToGuest(): void {
    this.setCoins(0);
    this.sessionCoins = 0;
  }

  /**
   * Ajoute des pièces au portefeuille et sauvegarde dans le stockage local
   */
  public static addCoins(amount: number): void {
    if (amount <= 0) {
      return;
    }
    if (!this.isInitialized) {
      this.init();
    }

    this.totalCoins += amount;
    this.sessionCoins += amount;
    this.save();
    this.notify(this.totalCoins, amount);
  }

  /**
   * Dépense des pièces (pour les améliorations futures hors-partie)
   */
  public static spendCoins(amount: number): boolean {
    if (amount <= 0) {
      return true;
    }
    if (!this.isInitialized) {
      this.init();
    }
    if (this.totalCoins < amount) {
      return false;
    }

    this.totalCoins -= amount;
    this.save();
    this.notify(this.totalCoins, -amount);
    return true;
  }

  /**
   * Permet aux composants UI (compteur HUD, menus) d'écouter les variations de solde
   */
  public static subscribe(callback: (total: number, delta: number) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  private static save(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, String(this.totalCoins));
    } catch (err) {
      console.warn('Impossible de sauvegarder les pièces dans localStorage :', err);
    }
  }

  private static notify(total: number, delta: number): void {
    for (const fn of this.listeners) {
      fn(total, delta);
    }
  }
}
