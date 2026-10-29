const menuMusicUrl = new URL('../assets/audio/music/menuhub.mp3', import.meta.url).href;
const buttonSfxUrl = new URL('../assets/audio/effects/button.mp3', import.meta.url).href;

/**
 * Gestionnaire audio centralisé pour The Old Citadel :
 * - Musique d'ambiance du menu principal et du campement (Hub)
 * - Effets sonores d'interface (clics de boutons, etc.)
 * - Gestion automatique de la politique d'autoplay des navigateurs
 */
export class SoundManager {
  private static isInitialized = false;
  private static musicAudio: HTMLAudioElement | null = null;
  private static isMusicPlaying = false;
  private static pendingMenuMusic = false;

  private static buttonPool: HTMLAudioElement[] = [];
  private static poolIndex = 0;
  private static readonly POOL_SIZE = 6;

  private static musicVolume = 0.35;
  private static sfxVolume = 0.45;

  public static init(): void {
    if (this.isInitialized || typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }
    this.isInitialized = true;

    // 1. Initialisation de la musique du menu / hub
    try {
      this.musicAudio = new Audio(menuMusicUrl);
      this.musicAudio.loop = true;
      this.musicAudio.volume = this.musicVolume;
      this.musicAudio.preload = 'auto';
    } catch (err) {
      console.warn('[SoundManager] Impossible d initialiser la musique :', err);
    }

    // 2. Initialisation de la réserve (pool) de sons pour les boutons
    try {
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const sfx = new Audio(buttonSfxUrl);
        sfx.volume = this.sfxVolume;
        sfx.preload = 'auto';
        this.buttonPool.push(sfx);
      }
    } catch (err) {
      console.warn('[SoundManager] Impossible d initialiser le pool SFX :', err);
    }

    // 3. Écouteur global capturant tous les clics sur des boutons d'interface
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          const target = (e.target as HTMLElement | null)?.closest(
            'button, a.main-menu-bmac-btn, [role="button"], input[type="button"], input[type="submit"]'
          );
          if (!target) return;

          // Ignorer les boutons désactivés ou grisés
          if (
            target.hasAttribute('disabled') ||
            target.classList.contains('disabled') ||
            target.classList.contains('hub-nav-tab-disabled')
          ) {
            return;
          }

          this.playButtonSound();
        },
        true // Phase de capture : intercepte même en cas de stopPropagation
      );

      // 4. Déblocage automatique de l'audio dès la première interaction utilisateur
      const unlockAutoplay = () => {
        if (this.pendingMenuMusic && this.musicAudio && this.isMusicPlaying) {
          this.musicAudio.play().catch(() => {});
          this.pendingMenuMusic = false;
        }
        window.removeEventListener('pointerdown', unlockAutoplay);
        window.removeEventListener('keydown', unlockAutoplay);
      };

      window.addEventListener('pointerdown', unlockAutoplay, { passive: true });
      window.addEventListener('keydown', unlockAutoplay, { passive: true });
    }
  }

  /**
   * Lance la musique d'ambiance du Menu / Hub.
   * Si elle est déjà en cours de lecture, ne la redémarre pas.
   */
  public static playMenuMusic(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (!this.musicAudio) return;

    if (this.isMusicPlaying && !this.musicAudio.paused) {
      return;
    }

    this.isMusicPlaying = true;
    this.musicAudio.volume = this.musicVolume;

    const playPromise = this.musicAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Politique d'autoplay du navigateur bloquée : on attend le premier clic / touche
        this.pendingMenuMusic = true;
      });
    }
  }

  /**
   * Arrête la musique du menu avec un fondu doux lors du départ en partie.
   */
  public static stopMenuMusic(fadeDurationMs = 350): void {
    this.pendingMenuMusic = false;
    this.isMusicPlaying = false;

    if (!this.musicAudio || typeof window === 'undefined') return;

    if (fadeDurationMs <= 0) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      return;
    }

    const startVol = this.musicAudio.volume;
    const startTime = performance.now();

    const fadeStep = () => {
      if (!this.musicAudio || this.isMusicPlaying) return;

      const elapsed = performance.now() - startTime;
      if (elapsed < fadeDurationMs) {
        this.musicAudio.volume = Math.max(0, startVol * (1 - elapsed / fadeDurationMs));
        requestAnimationFrame(fadeStep);
      } else {
        this.musicAudio.pause();
        this.musicAudio.currentTime = 0;
        this.musicAudio.volume = this.musicVolume;
      }
    };

    fadeStep();
  }

  /**
   * Joue le son de clic de bouton depuis le pool audio.
   */
  public static playButtonSound(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (this.buttonPool.length === 0) return;

    const sfx = this.buttonPool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.buttonPool.length;

    try {
      sfx.currentTime = 0;
      sfx.volume = this.sfxVolume;
      const promise = sfx.play();
      if (promise !== undefined) {
        promise.catch(() => {});
      }
    } catch {
      // Ignoré si le navigateur refuse
    }
  }

  /**
   * Ajuste les volumes généraux
   */
  public static setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicVolume;
    }
  }

  public static setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    for (const sfx of this.buttonPool) {
      sfx.volume = this.sfxVolume;
    }
  }
}
