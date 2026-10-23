import mainMenuBgUrl from '../assets/textures/mainmenu.jpg';
import logoUrl from '../assets/textures/logo.png';

export class MainMenu {
  private readonly menuElement: HTMLElement | null;
  private readonly logoImg: HTMLImageElement | null;
  private readonly mainView: HTMLElement | null;
  private readonly settingsView: HTMLElement | null;
  private readonly playBtn: HTMLButtonElement | null;
  private readonly settingsBtn: HTMLButtonElement | null;
  private readonly settingsBackBtn: HTMLButtonElement | null;
  private readonly fovSlider: HTMLInputElement | null;
  private readonly fovValueDisplay: HTMLElement | null;

  private onPlayCallback?: () => void;
  private onFovChangeCallback?: (fovDegrees: number) => void;

  constructor(
    onPlay?: () => void,
    onFovChange?: (fovDegrees: number) => void,
    initialFovDegrees = 75
  ) {
    this.menuElement = document.getElementById('main-menu');
    this.logoImg = document.getElementById('main-menu-logo') as HTMLImageElement | null;
    this.mainView = document.getElementById('main-menu-main-view');
    this.settingsView = document.getElementById('main-menu-settings-view');
    this.playBtn = document.getElementById('main-play-btn') as HTMLButtonElement | null;
    this.settingsBtn = document.getElementById('main-settings-btn') as HTMLButtonElement | null;
    this.settingsBackBtn = document.getElementById('main-settings-back-btn') as HTMLButtonElement | null;
    this.fovSlider = document.getElementById('main-fov-slider') as HTMLInputElement | null;
    this.fovValueDisplay = document.getElementById('main-fov-value');

    this.onPlayCallback = onPlay;
    this.onFovChangeCallback = onFovChange;

    if (this.menuElement) {
      this.menuElement.style.backgroundImage = `url('${mainMenuBgUrl}')`;
    }

    if (this.logoImg) {
      this.logoImg.src = logoUrl;
    }

    this.setFov(initialFovDegrees);

    this.playBtn?.addEventListener('click', this.handlePlayClick);
    this.settingsBtn?.addEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.addEventListener('click', this.handleBackClick);
    this.fovSlider?.addEventListener('input', this.handleFovInput);
  }

  private readonly handlePlayClick = (): void => {
    this.onPlayCallback?.();
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

  public isOpen(): boolean {
    return Boolean(this.menuElement && !this.menuElement.classList.contains('hidden'));
  }

  public isInSettings(): boolean {
    return Boolean(this.settingsView && !this.settingsView.classList.contains('hidden'));
  }

  public show(): void {
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
    this.settingsBtn?.removeEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.removeEventListener('click', this.handleBackClick);
    this.fovSlider?.removeEventListener('input', this.handleFovInput);
  }
}
