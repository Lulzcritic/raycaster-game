import { SoundManager } from '../core/SoundManager';
import { ControlsManager, type KeyboardLayout } from '../core/ControlsManager';

export class PauseMenu {
  private readonly menuElement: HTMLElement | null;
  private readonly mainView: HTMLElement | null;
  private readonly settingsView: HTMLElement | null;
  private readonly resumeButton: HTMLButtonElement | null;
  private readonly hubButton: HTMLButtonElement | null;
  private readonly abandonButton: HTMLButtonElement | null;
  private readonly settingsButton: HTMLButtonElement | null;
  private readonly settingsBackBtn: HTMLButtonElement | null;
  private readonly settingsResumeBtn: HTMLButtonElement | null;
  private readonly mainMenuButton: HTMLButtonElement | null;
  private readonly fovSlider: HTMLInputElement | null;
  private readonly fovValueDisplay: HTMLElement | null;

  // Éléments pour le switch de disposition du clavier (QWERTY / AZERTY)
  private readonly pauseLayoutIndicator: HTMLElement | null;
  private readonly pauseLayoutQwertyBtn: HTMLButtonElement | null;
  private readonly pauseLayoutAzertyBtn: HTMLButtonElement | null;
  private readonly pauseCtrlMove: HTMLElement | null;
  private readonly pauseCtrlStrafe: HTMLElement | null;
  private readonly unsubscribeControls?: () => void;

  // Boutons et labels pour le contrôle audio
  private readonly pauseMusicBtn: HTMLButtonElement | null;
  private readonly pauseMusicIcon: HTMLElement | null;
  private readonly pauseMusicText: HTMLElement | null;
  private readonly pauseSfxBtn: HTMLButtonElement | null;
  private readonly pauseSfxIcon: HTMLElement | null;
  private readonly pauseSfxText: HTMLElement | null;

  private readonly settingsMusicBtn: HTMLButtonElement | null;
  private readonly settingsMusicIcon: HTMLElement | null;
  private readonly settingsMusicText: HTMLElement | null;
  private readonly settingsSfxBtn: HTMLButtonElement | null;
  private readonly settingsSfxIcon: HTMLElement | null;
  private readonly settingsSfxText: HTMLElement | null;
  private readonly pauseAudioIndicator: HTMLElement | null;
  private readonly unsubscribeAudio?: () => void;

  private onResumeCallback?: () => void;
  private onFovChangeCallback?: (fovDegrees: number) => void;
  private onMainMenuCallback?: () => void;
  private onAbandonCallback?: () => void;
  private onReturnToHubCallback?: () => void;

  constructor(
    onResume?: () => void,
    onFovChange?: (fovDegrees: number) => void,
    initialFovDegrees = 75,
    onMainMenu?: () => void,
    onAbandon?: () => void,
    onReturnToHub?: () => void
  ) {
    this.menuElement = document.getElementById('pause-menu');
    this.mainView = document.getElementById('pause-main-view');
    this.settingsView = document.getElementById('pause-settings-view');
    this.resumeButton = document.getElementById('resume-btn') as HTMLButtonElement | null;
    this.hubButton = document.getElementById('pause-hub-btn') as HTMLButtonElement | null;
    this.abandonButton = document.getElementById('pause-abandon-btn') as HTMLButtonElement | null;
    this.settingsButton = document.getElementById('settings-btn') as HTMLButtonElement | null;
    this.settingsBackBtn = document.getElementById('settings-back-btn') as HTMLButtonElement | null;
    this.settingsResumeBtn = document.getElementById('settings-resume-btn') as HTMLButtonElement | null;
    this.mainMenuButton = document.getElementById('pause-main-menu-btn') as HTMLButtonElement | null;
    this.fovSlider = document.getElementById('fov-slider') as HTMLInputElement | null;
    this.fovValueDisplay = document.getElementById('fov-value');

    // Récupération des éléments du commutateur clavier
    this.pauseLayoutIndicator = document.getElementById('pause-layout-indicator');
    this.pauseLayoutQwertyBtn = document.getElementById('pause-layout-qwerty-btn') as HTMLButtonElement | null;
    this.pauseLayoutAzertyBtn = document.getElementById('pause-layout-azerty-btn') as HTMLButtonElement | null;
    this.pauseCtrlMove = document.getElementById('pause-ctrl-move');
    this.pauseCtrlStrafe = document.getElementById('pause-ctrl-strafe');

    // Récupération des éléments audio
    this.pauseMusicBtn = document.getElementById('pause-music-btn') as HTMLButtonElement | null;
    this.pauseMusicIcon = document.getElementById('pause-music-icon');
    this.pauseMusicText = document.getElementById('pause-music-text');
    this.pauseSfxBtn = document.getElementById('pause-sfx-btn') as HTMLButtonElement | null;
    this.pauseSfxIcon = document.getElementById('pause-sfx-icon');
    this.pauseSfxText = document.getElementById('pause-sfx-text');

    this.settingsMusicBtn = document.getElementById('settings-music-btn') as HTMLButtonElement | null;
    this.settingsMusicIcon = document.getElementById('settings-music-icon');
    this.settingsMusicText = document.getElementById('settings-music-text');
    this.settingsSfxBtn = document.getElementById('settings-sfx-btn') as HTMLButtonElement | null;
    this.settingsSfxIcon = document.getElementById('settings-sfx-icon');
    this.settingsSfxText = document.getElementById('settings-sfx-text');
    this.pauseAudioIndicator = document.getElementById('pause-audio-indicator');

    this.onResumeCallback = onResume;
    this.onFovChangeCallback = onFovChange;
    this.onMainMenuCallback = onMainMenu;
    this.onAbandonCallback = onAbandon;
    this.onReturnToHubCallback = onReturnToHub;

    this.setFov(initialFovDegrees);

    this.resumeButton?.addEventListener('click', this.handleResumeClick);
    this.hubButton?.addEventListener('click', this.handleHubClick);
    this.abandonButton?.addEventListener('click', this.handleAbandonClick);
    this.settingsButton?.addEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.addEventListener('click', this.handleBackClick);
    this.settingsResumeBtn?.addEventListener('click', this.handleResumeClick);
    this.mainMenuButton?.addEventListener('click', this.handleMainMenuClick);
    this.fovSlider?.addEventListener('input', this.handleFovInput);

    // Écouteurs pour le basculement audio
    this.pauseMusicBtn?.addEventListener('click', this.handleMusicToggle);
    this.pauseSfxBtn?.addEventListener('click', this.handleSfxToggle);
    this.settingsMusicBtn?.addEventListener('click', this.handleMusicToggle);
    this.settingsSfxBtn?.addEventListener('click', this.handleSfxToggle);

    // Écouteurs pour le commutateur de disposition clavier (QWERTY / AZERTY)
    this.pauseLayoutQwertyBtn?.addEventListener('click', this.handleQwertyClick);
    this.pauseLayoutAzertyBtn?.addEventListener('click', this.handleAzertyClick);

    // Abonnement aux changements de disposition du clavier
    this.unsubscribeControls = ControlsManager.subscribe((layout) => {
      this.updateLayoutDisplay(layout);
    });

    // Abonnement aux changements d'état muet audio
    this.unsubscribeAudio = SoundManager.subscribeMute(() => {
      this.updateAudioButtons();
    });

    // Initialisation visuelle de l'état des boutons audio
    this.updateAudioButtons();
  }

  private readonly handleResumeClick = (): void => {
    this.onResumeCallback?.();
  };

  private readonly handleHubClick = (): void => {
    this.onReturnToHubCallback?.();
  };

  private readonly handleAbandonClick = (): void => {
    this.onAbandonCallback?.();
  };

  private readonly handleMainMenuClick = (): void => {
    this.onMainMenuCallback?.();
  };

  private readonly handleSettingsClick = (): void => {
    this.showSettings();
  };

  private readonly handleBackClick = (): void => {
    this.showMain();
  };

  private readonly handleFovInput = (): void => {
    if (!this.fovSlider) {
      return;
    }
    const degrees = parseInt(this.fovSlider.value, 10);
    if (!Number.isNaN(degrees)) {
      if (this.fovValueDisplay) {
        this.fovValueDisplay.textContent = `${degrees}°`;
      }
      this.onFovChangeCallback?.(degrees);
    }
  };

  private readonly handleMusicToggle = (): void => {
    SoundManager.toggleMusicMute();
    this.updateAudioButtons();
    SoundManager.playButtonSound();
  };

  private readonly handleSfxToggle = (): void => {
    const isMuted = SoundManager.toggleSfxMute();
    this.updateAudioButtons();
    if (!isMuted) {
      // Retour sonore immédiat pour confirmer que les bruitages sont réactivés
      SoundManager.playButtonSound();
    }
  };

  private readonly handleQwertyClick = (): void => {
    ControlsManager.setLayout('qwerty');
    SoundManager.playButtonSound();
  };

  private readonly handleAzertyClick = (): void => {
    ControlsManager.setLayout('azerty');
    SoundManager.playButtonSound();
  };

  /**
   * Met à jour les libellés, styles visuels et indicateurs du commutateur clavier.
   */
  public updateLayoutDisplay(layout: KeyboardLayout): void {
    const isAzerty = layout === 'azerty';
    if (this.pauseLayoutIndicator) {
      this.pauseLayoutIndicator.textContent = isAzerty ? 'AZERTY' : 'QWERTY';
    }
    if (this.pauseLayoutQwertyBtn) {
      this.pauseLayoutQwertyBtn.classList.toggle('active', !isAzerty);
      this.pauseLayoutQwertyBtn.setAttribute('aria-pressed', String(!isAzerty));
    }
    if (this.pauseLayoutAzertyBtn) {
      this.pauseLayoutAzertyBtn.classList.toggle('active', isAzerty);
      this.pauseLayoutAzertyBtn.setAttribute('aria-pressed', String(isAzerty));
    }

    const labels = ControlsManager.getLabels(layout);
    if (this.pauseCtrlMove) {
      this.pauseCtrlMove.textContent = `${labels.forwardBackward} : AVANCER / RECULER`;
    }
    if (this.pauseCtrlStrafe) {
      this.pauseCtrlStrafe.textContent = `${labels.strafe} : GAUCHE / DROITE`;
    }
  }

  /**
   * Met à jour les libellés, icônes et styles visuels (.is-muted) des boutons audio.
   */
  public updateAudioButtons(): void {
    const isMusicMuted = SoundManager.isMusicMute();
    const isSfxMuted = SoundManager.isSfxMute();

    const musicIcon = isMusicMuted ? '🔇' : '🎵';
    const musicText = isMusicMuted ? 'MUSIQUE : OFF' : 'MUSIQUE : ON';
    const musicTitle = isMusicMuted ? 'Activer la musique' : 'Couper la musique';

    const sfxIcon = isSfxMuted ? '🔇' : '🔊';
    const sfxText = isSfxMuted ? 'EFFETS : OFF' : 'EFFETS : ON';
    const sfxTitle = isSfxMuted ? 'Activer les effets sonores' : 'Couper les effets sonores';

    // Mise à jour de la vue Pause Principale
    if (this.pauseMusicIcon) this.pauseMusicIcon.textContent = musicIcon;
    if (this.pauseMusicText) this.pauseMusicText.textContent = musicText;
    if (this.pauseMusicBtn) {
      this.pauseMusicBtn.title = musicTitle;
      this.pauseMusicBtn.classList.toggle('is-muted', isMusicMuted);
    }

    if (this.pauseSfxIcon) this.pauseSfxIcon.textContent = sfxIcon;
    if (this.pauseSfxText) this.pauseSfxText.textContent = sfxText;
    if (this.pauseSfxBtn) {
      this.pauseSfxBtn.title = sfxTitle;
      this.pauseSfxBtn.classList.toggle('is-muted', isSfxMuted);
    }

    // Mise à jour de la vue Paramètres
    if (this.settingsMusicIcon) this.settingsMusicIcon.textContent = musicIcon;
    if (this.settingsMusicText) this.settingsMusicText.textContent = musicText;
    if (this.settingsMusicBtn) {
      this.settingsMusicBtn.title = musicTitle;
      this.settingsMusicBtn.classList.toggle('is-muted', isMusicMuted);
    }

    if (this.settingsSfxIcon) this.settingsSfxIcon.textContent = sfxIcon;
    if (this.settingsSfxText) this.settingsSfxText.textContent = sfxText;
    if (this.settingsSfxBtn) {
      this.settingsSfxBtn.title = sfxTitle;
      this.settingsSfxBtn.classList.toggle('is-muted', isSfxMuted);
    }

    if (this.pauseAudioIndicator) {
      if (isMusicMuted && isSfxMuted) {
        this.pauseAudioIndicator.textContent = 'TOUT COUPÉ';
        this.pauseAudioIndicator.style.color = '#f87171';
      } else if (!isMusicMuted && !isSfxMuted) {
        this.pauseAudioIndicator.textContent = 'SON ACTIF';
        this.pauseAudioIndicator.style.color = '#facc15';
      } else {
        this.pauseAudioIndicator.textContent = 'PARTIEL';
        this.pauseAudioIndicator.style.color = '#38bdf8';
      }
    }
  }

  public showMain(): void {
    this.mainView?.classList.remove('hidden');
    this.settingsView?.classList.add('hidden');
  }

  public showSettings(): void {
    this.mainView?.classList.add('hidden');
    this.settingsView?.classList.remove('hidden');
  }

  public setFov(fovDegrees: number): void {
    if (this.fovSlider) {
      this.fovSlider.value = String(fovDegrees);
    }
    if (this.fovValueDisplay) {
      this.fovValueDisplay.textContent = `${fovDegrees}°`;
    }
  }

  public show(): void {
    this.updateAudioButtons();
    this.updateLayoutDisplay(ControlsManager.getLayout());
    this.showMain();
    this.menuElement?.classList.remove('hidden');
  }

  public hide(): void {
    this.menuElement?.classList.add('hidden');
  }

  public destroy(): void {
    this.resumeButton?.removeEventListener('click', this.handleResumeClick);
    this.hubButton?.removeEventListener('click', this.handleHubClick);
    this.abandonButton?.removeEventListener('click', this.handleAbandonClick);
    this.settingsButton?.removeEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.removeEventListener('click', this.handleBackClick);
    this.settingsResumeBtn?.removeEventListener('click', this.handleResumeClick);
    this.mainMenuButton?.removeEventListener('click', this.handleMainMenuClick);
    this.fovSlider?.removeEventListener('input', this.handleFovInput);

    this.pauseMusicBtn?.removeEventListener('click', this.handleMusicToggle);
    this.pauseSfxBtn?.removeEventListener('click', this.handleSfxToggle);
    this.settingsMusicBtn?.removeEventListener('click', this.handleMusicToggle);
    this.settingsSfxBtn?.removeEventListener('click', this.handleSfxToggle);

    this.pauseLayoutQwertyBtn?.removeEventListener('click', this.handleQwertyClick);
    this.pauseLayoutAzertyBtn?.removeEventListener('click', this.handleAzertyClick);
    this.unsubscribeControls?.();
    this.unsubscribeAudio?.();
  }
}
