/**
 * Gestionnaire de l'écran de chargement initial du client.
 * Affiche la progression en direct du téléchargement des assets (textures, sprites, audio 3D, monstres)
 * et anime la disparition fluide lors de l'accès au menu principal.
 */
export class LoadingScreen {
  private static instance: LoadingScreen | null = null;
  private readonly container: HTMLElement | null = null;
  private readonly fillEl: HTMLElement | null = null;
  private readonly percentEl: HTMLElement | null = null;
  private readonly statusEl: HTMLElement | null = null;
  private readonly hintEl: HTMLElement | null = null;
  private currentProgress = 0;
  private hintInterval: any = null;

  private readonly hints = [
    'Écoutez attentivement : le moteur sonore 3D spatialisé vous aide à repérer les monstres et pillards à proximité.',
    'Les piliers massifs des grandes salles permettent de vous dissimuler et de faire ricocher vos orbes magiques.',
    'Ne soyez pas trop cupide : sécurisez votre équipement et vos pièces en vous extrayant dès que possible.',
    'Méfiez-vous des coffres solitaires : certains se réveillent sous forme de Mimics féroces !',
    'Améliorez vos caractéristiques au Campement grâce aux pièces d\'or extraites des profondeurs de la Citadelle.',
    'L\'Homonculus de main gauche pulse et détecte la présence des coffres à travers les murs de pierre.',
    'Chaque Boss de Sanctuaire possède son propre thème musical épique qui retentit dès le début de l\'affrontement.',
    'En donjon PvPvE, les autres aventuriers sont des rivaux : surveillez leurs pas et gardez vos distances.',
  ];

  constructor() {
    if (typeof document !== 'undefined') {
      this.container = document.getElementById('app-loading-screen');
      this.fillEl = document.getElementById('loading-bar-fill');
      this.percentEl = document.getElementById('loading-percent');
      this.statusEl = document.getElementById('loading-status');
      this.hintEl = document.getElementById('loading-hint');

      this.startHintRotation();
    }
  }

  public static getInstance(): LoadingScreen {
    if (!this.instance) {
      this.instance = new LoadingScreen();
    }
    return this.instance;
  }

  public setProgress(percent: number, statusText?: string): void {
    this.currentProgress = Math.max(this.currentProgress, Math.min(100, Math.round(percent)));
    if (this.fillEl) {
      this.fillEl.style.width = `${this.currentProgress}%`;
    }
    if (this.percentEl) {
      this.percentEl.textContent = `${this.currentProgress}%`;
    }
    if (statusText && this.statusEl) {
      this.statusEl.textContent = statusText;
    }
  }

  public async finish(): Promise<void> {
    this.setProgress(100, 'Prêt pour l\'expédition !');
    if (this.hintInterval) {
      clearInterval(this.hintInterval);
      this.hintInterval = null;
    }

    // Petite temporisation pour savourer le 100%
    if (typeof window !== 'undefined') {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (this.container) {
      this.container.classList.add('fade-out');
      if (typeof window !== 'undefined') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      this.container.style.display = 'none';
      this.container.remove();
    }
  }

  private startHintRotation(): void {
    if (!this.hintEl || typeof window === 'undefined') return;
    let hintIndex = Math.floor(Math.random() * this.hints.length);
    this.hintEl.textContent = this.hints[hintIndex];

    this.hintInterval = setInterval(() => {
      hintIndex = (hintIndex + 1) % this.hints.length;
      if (this.hintEl) {
        this.hintEl.style.opacity = '0';
        setTimeout(() => {
          if (this.hintEl) {
            this.hintEl.textContent = this.hints[hintIndex];
            this.hintEl.style.opacity = '1';
          }
        }, 200);
      }
    }, 3200);
  }
}
