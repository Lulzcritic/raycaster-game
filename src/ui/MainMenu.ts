import mainMenuBgUrl from '../assets/textures/mainmenu.jpg';
import logoUrl from '../assets/textures/logo.png';
import { WalletManager } from '../core/WalletManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import { AuthManager } from '../core/AuthManager';
import { AuthModal } from './AuthModal';
import { SoundManager } from '../core/SoundManager';
import { ControlsManager, type KeyboardLayout } from '../core/ControlsManager';
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

  // Éléments du commutateur clavier (QWERTY / AZERTY)
  private readonly mainLayoutIndicator: HTMLElement | null;
  private readonly mainLayoutQwertyBtn: HTMLButtonElement | null;
  private readonly mainLayoutAzertyBtn: HTMLButtonElement | null;
  private readonly mainCtrlMove: HTMLElement | null;
  private readonly mainCtrlStrafe: HTMLElement | null;
  private readonly unsubscribeControls?: () => void;

  private onPlayCallback?: () => void;
  private onLadderCallback?: () => void;
  private onFovChangeCallback?: (fovDegrees: number) => void;

  constructor(
    onPlay?: () => void,
    onFovChange?: (fovDegrees: number) => void,
    initialFovDegrees = 75,
    onLadder?: () => void
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

    // Récupération des éléments du commutateur clavier
    this.mainLayoutIndicator = document.getElementById('main-layout-indicator');
    this.mainLayoutQwertyBtn = document.getElementById('main-layout-qwerty-btn') as HTMLButtonElement | null;
    this.mainLayoutAzertyBtn = document.getElementById('main-layout-azerty-btn') as HTMLButtonElement | null;
    this.mainCtrlMove = document.getElementById('main-ctrl-move');
    this.mainCtrlStrafe = document.getElementById('main-ctrl-strafe');

    this.onPlayCallback = onPlay;
    this.onLadderCallback = onLadder;
    this.onFovChangeCallback = onFovChange;

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

    // Écouteurs pour le commutateur de disposition clavier (QWERTY / AZERTY)
    this.mainLayoutQwertyBtn?.addEventListener('click', this.handleQwertyClick);
    this.mainLayoutAzertyBtn?.addEventListener('click', this.handleAzertyClick);

    // Abonnement aux changements de disposition clavier
    this.unsubscribeControls = ControlsManager.subscribe((layout) => {
      this.updateLayoutDisplay(layout);
    });

    // Écoute des changements d'authentification pour mettre à jour l'interface
    this.unsubscribeAuth = AuthManager.subscribe((user) => {
      this.updateAccountDisplay(user);
    });
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
        this.authBtn.title = `Connecté en tant que ${user.username}. Cliquez pour gérer votre compte.`;
      } else {
        this.authBtn.textContent = `SE CONNECTER / S'INSCRIRE`;
        this.authBtn.title = `Connectez-vous pour sauvegarder votre butin et votre or sur la base de données.`;
      }
    }

    if (this.accountBadge) {
      if (user) {
        this.accountBadge.textContent = `🛡️ Aventurier : ${user.username} (Sauvegarde active)`;
        this.accountBadge.className = 'account-badge authenticated';
      } else {
        this.accountBadge.textContent = `Mode Invité (sauvegarde inactive)`;
        this.accountBadge.className = 'account-badge guest';
      }
    }

    if (this.coinText) {
      this.coinText.textContent = String(WalletManager.getCoins());
    }
  }

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

  public showMain(): void {
    if (this.coinText) {
      this.coinText.textContent = String(WalletManager.getCoins());
    }
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

  public isOpen(): boolean {
    return Boolean(this.menuElement && !this.menuElement.classList.contains('hidden'));
  }

  public isInSettings(): boolean {
    return Boolean(this.settingsView && !this.settingsView.classList.contains('hidden'));
  }

  public show(): void {
    this.updateLayoutDisplay(ControlsManager.getLayout());
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
    this.fovSlider?.removeEventListener('input', this.handleFovInput);
    this.mainLayoutQwertyBtn?.removeEventListener('click', this.handleQwertyClick);
    this.mainLayoutAzertyBtn?.removeEventListener('click', this.handleAzertyClick);
    this.unsubscribeControls?.();
    this.unsubscribeAuth?.();
  }
}
