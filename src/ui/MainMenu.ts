import mainMenuBgUrl from '../assets/textures/mainmenu.jpg';
import logoUrl from '../assets/textures/logo.png';
import { WalletManager } from '../core/WalletManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import { AuthManager } from '../core/AuthManager';
import { AuthModal } from './AuthModal';
import { SoundManager } from '../core/SoundManager';
import { ControlsManager, type KeyboardLayout } from '../core/ControlsManager';
import { APP_TITLE_WITH_VERSION } from '../config/version';
import { I18nService, type Language } from '../core/I18nService';
import type { AuthUser } from '../types/auth';

export class MainMenu {
  private readonly menuElement: HTMLElement | null;
  private readonly logoImg: HTMLImageElement | null;
  private readonly mainView: HTMLElement | null;
  private readonly settingsView: HTMLElement | null;
  private readonly playBtn: HTMLButtonElement | null;
  private readonly authBtn: HTMLButtonElement | null;
  private readonly ladderBtn: HTMLButtonElement | null;
  private readonly accountBadge: HTMLElement | null;
  private readonly settingsBtn: HTMLButtonElement | null;
  private readonly settingsBackBtn: HTMLButtonElement | null;
  private readonly fovSlider: HTMLInputElement | null;
  private readonly fovValueDisplay: HTMLElement | null;
  private readonly coinIcon: HTMLImageElement | null;
  private readonly coinText: HTMLElement | null;
  private readonly authModal: AuthModal;
  private unsubscribeAuth?: () => void;

  // Éléments du commutateur de langue (EN / FR)
  private readonly mainLangIndicator: HTMLElement | null;
  private readonly mainLangEnBtn: HTMLButtonElement | null;
  private readonly mainLangFrBtn: HTMLButtonElement | null;
  private unsubscribeLanguage?: () => void;

  // Éléments du commutateur clavier (QWERTY / AZERTY)
  private readonly mainLayoutIndicator: HTMLElement | null;
  private readonly mainLayoutQwertyBtn: HTMLButtonElement | null;
  private readonly mainLayoutAzertyBtn: HTMLButtonElement | null;
  private readonly mainCtrlMove: HTMLElement | null;
  private readonly mainCtrlStrafe: HTMLElement | null;
  private readonly unsubscribeControls?: () => void;

  // Éléments du panneau Réglages Audio
  private readonly mainSettingsMusicBtn: HTMLButtonElement | null;
  private readonly mainSettingsMusicIcon: HTMLElement | null;
  private readonly mainSettingsMusicText: HTMLElement | null;
  private readonly mainSettingsSfxBtn: HTMLButtonElement | null;
  private readonly mainSettingsSfxIcon: HTMLElement | null;
  private readonly mainSettingsSfxText: HTMLElement | null;
  private readonly mainAudioIndicator: HTMLElement | null;
  private readonly unsubscribeAudio?: () => void;

  private isOpenedFromHub = false;
  private onBackToHubCallback?: () => void;

  // Pied de page : version de l'application
  private readonly versionDisplay: HTMLElement | null;

  private onPlayCallback?: () => void;
  private onLadderCallback?: () => void;
  private onFovChangeCallback?: (fovDegrees: number) => void;

  constructor(
    onPlay?: () => void,
    onFovChange?: (fovDegrees: number) => void,
    initialFovDegrees = 75,
    onLadder?: () => void,
    onBackToHub?: () => void
  ) {
    this.menuElement = document.getElementById('main-menu');
    this.logoImg = document.getElementById('main-menu-logo') as HTMLImageElement | null;
    this.mainView = document.getElementById('main-menu-main-view');
    this.settingsView = document.getElementById('main-menu-settings-view');
    this.playBtn = document.getElementById('main-play-btn') as HTMLButtonElement | null;
    this.authBtn = document.getElementById('main-auth-btn') as HTMLButtonElement | null;
    this.ladderBtn = document.getElementById('main-ladder-btn') as HTMLButtonElement | null;
    this.accountBadge = document.getElementById('main-menu-account-badge');
    this.settingsBtn = document.getElementById('main-settings-btn') as HTMLButtonElement | null;
    this.settingsBackBtn = document.getElementById('main-settings-back-btn') as HTMLButtonElement | null;
    this.fovSlider = document.getElementById('main-fov-slider') as HTMLInputElement | null;
    this.fovValueDisplay = document.getElementById('main-fov-value');
    this.coinIcon = document.getElementById('main-menu-coin-icon') as HTMLImageElement | null;
    this.coinText = document.getElementById('main-menu-coin-text');

    // Récupération des éléments du commutateur de langue
    this.mainLangIndicator = document.getElementById('main-lang-indicator');
    this.mainLangEnBtn = document.getElementById('main-lang-en-btn') as HTMLButtonElement | null;
    this.mainLangFrBtn = document.getElementById('main-lang-fr-btn') as HTMLButtonElement | null;

    // Récupération des éléments du commutateur clavier
    this.mainLayoutIndicator = document.getElementById('main-layout-indicator');
    this.mainLayoutQwertyBtn = document.getElementById('main-layout-qwerty-btn') as HTMLButtonElement | null;
    this.mainLayoutAzertyBtn = document.getElementById('main-layout-azerty-btn') as HTMLButtonElement | null;
    this.mainCtrlMove = document.getElementById('main-ctrl-move');
    this.mainCtrlStrafe = document.getElementById('main-ctrl-strafe');

    // Récupération des éléments audio
    this.mainSettingsMusicBtn = document.getElementById('main-settings-music-btn') as HTMLButtonElement | null;
    this.mainSettingsMusicIcon = document.getElementById('main-settings-music-icon');
    this.mainSettingsMusicText = document.getElementById('main-settings-music-text');
    this.mainSettingsSfxBtn = document.getElementById('main-settings-sfx-btn') as HTMLButtonElement | null;
    this.mainSettingsSfxIcon = document.getElementById('main-settings-sfx-icon');
    this.mainSettingsSfxText = document.getElementById('main-settings-sfx-text');
    this.mainAudioIndicator = document.getElementById('main-audio-indicator');

    // Récupération de l'affichage de la version
    this.versionDisplay = document.getElementById('main-menu-version');
    this.updateVersionDisplay();

    this.onPlayCallback = onPlay;
    this.onLadderCallback = onLadder;
    this.onFovChangeCallback = onFovChange;
    this.onBackToHubCallback = onBackToHub;

    this.authModal = new AuthModal(() => {
      this.updateAccountDisplay(AuthManager.getUser());
      if (this.coinText) {
        this.coinText.textContent = String(WalletManager.getCoins());
      }
    });

    if (this.menuElement) {
      this.menuElement.style.backgroundImage = `url('${mainMenuBgUrl}')`;
    }

    if (this.logoImg) {
      this.logoImg.src = logoUrl;
    }

    if (this.coinIcon) {
      this.coinIcon.src = CoinSpriteManager.getCoinUrl();
    }

    this.setFov(initialFovDegrees);

    this.playBtn?.addEventListener('click', this.handlePlayClick);
    this.authBtn?.addEventListener('click', this.handleAuthClick);
    this.ladderBtn?.addEventListener('click', this.handleLadderClick);
    this.settingsBtn?.addEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.addEventListener('click', this.handleBackClick);
    this.fovSlider?.addEventListener('input', this.handleFovInput);

    // Écouteurs pour le commutateur de langue (EN / FR)
    this.mainLangEnBtn?.addEventListener('click', this.handleLangEnClick);
    this.mainLangFrBtn?.addEventListener('click', this.handleLangFrClick);

    // Écouteurs audio
    this.mainSettingsMusicBtn?.addEventListener('click', this.handleMusicToggle);
    this.mainSettingsSfxBtn?.addEventListener('click', this.handleSfxToggle);

    // Écouteurs pour le commutateur de disposition clavier (QWERTY / AZERTY)
    this.mainLayoutQwertyBtn?.addEventListener('click', this.handleQwertyClick);
    this.mainLayoutAzertyBtn?.addEventListener('click', this.handleAzertyClick);

    // Abonnement aux changements d'état muet audio
    this.unsubscribeAudio = SoundManager.subscribeMute(() => {
      this.updateAudioButtons();
    });

    // Abonnement aux changements de langue
    this.unsubscribeLanguage = I18nService.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });

    // Abonnement aux changements de disposition clavier
    this.unsubscribeControls = ControlsManager.subscribe((layout) => {
      this.updateLayoutDisplay(layout);
    });

    // Écoute des changements d'authentification pour mettre à jour l'interface
    this.unsubscribeAuth = AuthManager.subscribe((user) => {
      this.updateAccountDisplay(user);
    });

    this.updateAudioButtons();
    this.updateLanguageDisplay(I18nService.getCurrentLanguage());
  }

  private readonly handleLangEnClick = (): void => {
    I18nService.setLanguage('en');
    SoundManager.playButtonSound();
  };

  private readonly handleLangFrClick = (): void => {
    I18nService.setLanguage('fr');
    SoundManager.playButtonSound();
  };

  /**
   * Met à jour les libellés, styles visuels et indicateurs du commutateur de langue.
   */
  public updateLanguageDisplay(lang: Language): void {
    const isFr = lang === 'fr';
    if (this.mainLangIndicator) {
      this.mainLangIndicator.textContent = isFr ? 'FRANÇAIS' : 'ENGLISH';
    }
    if (this.mainLangEnBtn) {
      this.mainLangEnBtn.classList.toggle('active', !isFr);
      this.mainLangEnBtn.setAttribute('aria-pressed', String(!isFr));
    }
    if (this.mainLangFrBtn) {
      this.mainLangFrBtn.classList.toggle('active', isFr);
      this.mainLangFrBtn.setAttribute('aria-pressed', String(isFr));
    }

    // Réactualisation des textes dynamiques
    this.updateAccountDisplay(AuthManager.getUser());
    this.updateAudioButtons();
    this.updateLayoutDisplay(ControlsManager.getLayout());
    I18nService.translateDOM(this.menuElement ?? document);
  }

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
    if (this.mainLayoutIndicator) {
      this.mainLayoutIndicator.textContent = isAzerty ? 'AZERTY' : 'QWERTY';
    }
    if (this.mainLayoutQwertyBtn) {
      this.mainLayoutQwertyBtn.classList.toggle('active', !isAzerty);
      this.mainLayoutQwertyBtn.setAttribute('aria-pressed', String(!isAzerty));
    }
    if (this.mainLayoutAzertyBtn) {
      this.mainLayoutAzertyBtn.classList.toggle('active', isAzerty);
      this.mainLayoutAzertyBtn.setAttribute('aria-pressed', String(isAzerty));
    }

    const labels = ControlsManager.getLabels(layout);
    if (this.mainCtrlMove) {
      this.mainCtrlMove.textContent = labels.forwardBackward;
    }
    if (this.mainCtrlStrafe) {
      this.mainCtrlStrafe.textContent = labels.strafe;
    }
  }

  private readonly handlePlayClick = (): void => {
    this.onPlayCallback?.();
  };

  private readonly handleLadderClick = (): void => {
    SoundManager.playButtonSound();
    this.onLadderCallback?.();
  };

  private readonly handleAuthClick = (): void => {
    SoundManager.playButtonSound();
    this.authModal.show(AuthManager.isLoggedIn() ? 'login' : 'login');
  };

  private updateAccountDisplay(user: AuthUser | null): void {
    if (this.authBtn) {
      if (user) {
        this.authBtn.textContent = `👤 ${user.username.toUpperCase()}`;
        this.authBtn.title = I18nService.t('menu.connected_tooltip', { name: user.username });
      } else {
        this.authBtn.textContent = I18nService.t('menu.login_register');
        this.authBtn.title = I18nService.t('menu.guest_tooltip');
      }
    }

    if (this.accountBadge) {
      if (user) {
        this.accountBadge.textContent = I18nService.t('menu.connected_badge', { name: user.username });
        this.accountBadge.className = 'account-badge authenticated';
      } else {
        this.accountBadge.textContent = I18nService.t('menu.guest_badge');
        this.accountBadge.className = 'account-badge guest';
      }
    }

    if (this.coinText) {
      this.coinText.textContent = String(WalletManager.getCoins());
    }
  }

  private readonly handleMusicToggle = (): void => {
    SoundManager.toggleMusicMute();
    this.updateAudioButtons();
    SoundManager.playButtonSound();
  };

  private readonly handleSfxToggle = (): void => {
    const isMuted = SoundManager.toggleSfxMute();
    this.updateAudioButtons();
    if (!isMuted) {
      SoundManager.playButtonSound();
    }
  };

  /**
   * Met à jour les libellés, icônes et styles visuels (.is-muted) des boutons audio du menu principal.
   */
  public updateAudioButtons(): void {
    const isMusicMuted = SoundManager.isMusicMute();
    const isSfxMuted = SoundManager.isSfxMute();

    const musicIcon = isMusicMuted ? '🔇' : '🎵';
    const musicText = isMusicMuted ? I18nService.t('settings.music_off') : I18nService.t('settings.music_on');
    const musicTitle = isMusicMuted
      ? (I18nService.getCurrentLanguage() === 'fr' ? 'Activer la musique' : 'Enable music')
      : (I18nService.getCurrentLanguage() === 'fr' ? 'Couper la musique' : 'Mute music');

    const sfxIcon = isSfxMuted ? '🔇' : '🔊';
    const sfxText = isSfxMuted ? I18nService.t('settings.sfx_off') : I18nService.t('settings.sfx_on');
    const sfxTitle = isSfxMuted
      ? (I18nService.getCurrentLanguage() === 'fr' ? 'Activer les effets sonores' : 'Enable sound effects')
      : (I18nService.getCurrentLanguage() === 'fr' ? 'Couper les effets sonores' : 'Mute sound effects');

    if (this.mainSettingsMusicIcon) this.mainSettingsMusicIcon.textContent = musicIcon;
    if (this.mainSettingsMusicText) this.mainSettingsMusicText.textContent = musicText;
    if (this.mainSettingsMusicBtn) {
      this.mainSettingsMusicBtn.title = musicTitle;
      this.mainSettingsMusicBtn.classList.toggle('is-muted', isMusicMuted);
    }

    if (this.mainSettingsSfxIcon) this.mainSettingsSfxIcon.textContent = sfxIcon;
    if (this.mainSettingsSfxText) this.mainSettingsSfxText.textContent = sfxText;
    if (this.mainSettingsSfxBtn) {
      this.mainSettingsSfxBtn.title = sfxTitle;
      this.mainSettingsSfxBtn.classList.toggle('is-muted', isSfxMuted);
    }

    if (this.mainAudioIndicator) {
      if (isMusicMuted && isSfxMuted) {
        this.mainAudioIndicator.textContent = I18nService.t('settings.sound_muted');
        this.mainAudioIndicator.style.color = '#f87171';
      } else if (!isMusicMuted && !isSfxMuted) {
        this.mainAudioIndicator.textContent = I18nService.t('settings.sound_active');
        this.mainAudioIndicator.style.color = '#facc15';
      } else {
        this.mainAudioIndicator.textContent = I18nService.t('settings.sound_partial');
        this.mainAudioIndicator.style.color = '#38bdf8';
      }
    }
  }

  private readonly handleSettingsClick = (): void => {
    this.showSettings();
  };

  private readonly handleBackClick = (): void => {
    SoundManager.playButtonSound();
    if (this.isOpenedFromHub) {
      this.isOpenedFromHub = false;
      this.hide();
      this.menuElement?.classList.remove('is-in-settings');
      this.onBackToHubCallback?.();
    } else {
      this.showMain();
    }
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

  public showMain(): void {
    this.isOpenedFromHub = false;
    this.menuElement?.classList.remove('is-in-settings');
    if (this.coinText) {
      this.coinText.textContent = String(WalletManager.getCoins());
    }
    this.mainView?.classList.remove('hidden');
    this.settingsView?.classList.add('hidden');
  }

  public showSettings(fromHub = false): void {
    this.isOpenedFromHub = fromHub;
    this.mainView?.classList.add('hidden');
    this.settingsView?.classList.remove('hidden');
    this.menuElement?.classList.add('is-in-settings');
    this.menuElement?.classList.remove('hidden');
    this.updateAudioButtons();
  }

  public setOnBackToHub(cb: () => void): void {
    this.onBackToHubCallback = cb;
  }

  public setFov(fovDegrees: number): void {
    if (this.fovSlider) {
      this.fovSlider.value = String(fovDegrees);
    }
    if (this.fovValueDisplay) {
      this.fovValueDisplay.textContent = `${fovDegrees}°`;
    }
  }

  public isOpen(): boolean {
    return Boolean(this.menuElement && !this.menuElement.classList.contains('hidden'));
  }

  public isInSettings(): boolean {
    return Boolean(this.settingsView && !this.settingsView.classList.contains('hidden'));
  }

  public updateVersionDisplay(): void {
    if (this.versionDisplay) {
      this.versionDisplay.textContent = APP_TITLE_WITH_VERSION;
    }
  }

  public show(): void {
    this.updateLayoutDisplay(ControlsManager.getLayout());
    this.updateVersionDisplay();
    this.showMain();
    this.menuElement?.classList.remove('hidden');
    this.playAppearAnimation();
  }

  public hide(): void {
    this.menuElement?.classList.add('hidden');
  }

  public playAppearAnimation(): void {
    if (this.logoImg) {
      this.logoImg.classList.remove('animate-appear');
      void this.logoImg.offsetWidth;
      this.logoImg.classList.add('animate-appear');
    }
  }

  public destroy(): void {
    this.playBtn?.removeEventListener('click', this.handlePlayClick);
    this.authBtn?.removeEventListener('click', this.handleAuthClick);
    this.ladderBtn?.removeEventListener('click', this.handleLadderClick);
    this.settingsBtn?.removeEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.removeEventListener('click', this.handleBackClick);
    this.mainSettingsMusicBtn?.removeEventListener('click', this.handleMusicToggle);
    this.mainSettingsSfxBtn?.removeEventListener('click', this.handleSfxToggle);
    this.fovSlider?.removeEventListener('input', this.handleFovInput);
    this.mainLayoutQwertyBtn?.removeEventListener('click', this.handleQwertyClick);
    this.mainLayoutAzertyBtn?.removeEventListener('click', this.handleAzertyClick);
    this.mainLangEnBtn?.removeEventListener('click', this.handleLangEnClick);
    this.mainLangFrBtn?.removeEventListener('click', this.handleLangFrClick);
    this.unsubscribeLanguage?.();
    this.unsubscribeControls?.();
    this.unsubscribeAuth?.();
    this.unsubscribeAudio?.();
  }
}
