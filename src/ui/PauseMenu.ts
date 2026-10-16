export class PauseMenu {
  private readonly menuElement: HTMLElement | null;
  private readonly mainView: HTMLElement | null;
  private readonly settingsView: HTMLElement | null;
  private readonly resumeButton: HTMLButtonElement | null;
  private readonly settingsButton: HTMLButtonElement | null;
  private readonly settingsBackBtn: HTMLButtonElement | null;
  private readonly settingsResumeBtn: HTMLButtonElement | null;
  private readonly fovSlider: HTMLInputElement | null;
  private readonly fovValueDisplay: HTMLElement | null;

  private onResumeCallback?: () => void;
  private onFovChangeCallback?: (fovDegrees: number) => void;

  constructor(
    onResume?: () => void,
    onFovChange?: (fovDegrees: number) => void,
    initialFovDegrees = 75
  ) {
    this.menuElement = document.getElementById('pause-menu');
    this.mainView = document.getElementById('pause-main-view');
    this.settingsView = document.getElementById('pause-settings-view');
    this.resumeButton = document.getElementById('resume-btn') as HTMLButtonElement | null;
    this.settingsButton = document.getElementById('settings-btn') as HTMLButtonElement | null;
    this.settingsBackBtn = document.getElementById('settings-back-btn') as HTMLButtonElement | null;
    this.settingsResumeBtn = document.getElementById('settings-resume-btn') as HTMLButtonElement | null;
    this.fovSlider = document.getElementById('fov-slider') as HTMLInputElement | null;
    this.fovValueDisplay = document.getElementById('fov-value');

    this.onResumeCallback = onResume;
    this.onFovChangeCallback = onFovChange;

    this.setFov(initialFovDegrees);

    this.resumeButton?.addEventListener('click', this.handleResumeClick);
    this.settingsButton?.addEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.addEventListener('click', this.handleBackClick);
    this.settingsResumeBtn?.addEventListener('click', this.handleResumeClick);
    this.fovSlider?.addEventListener('input', this.handleFovInput);
  }

  private readonly handleResumeClick = (): void => {
    this.onResumeCallback?.();
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

  public show(): void {
    this.showMain();
    this.menuElement?.classList.remove('hidden');
  }

  public hide(): void {
    this.menuElement?.classList.add('hidden');
  }

  public destroy(): void {
    this.resumeButton?.removeEventListener('click', this.handleResumeClick);
    this.settingsButton?.removeEventListener('click', this.handleSettingsClick);
    this.settingsBackBtn?.removeEventListener('click', this.handleBackClick);
    this.settingsResumeBtn?.removeEventListener('click', this.handleResumeClick);
    this.fovSlider?.removeEventListener('input', this.handleFovInput);
  }
}
