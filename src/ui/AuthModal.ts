import { AuthManager } from '../core/AuthManager';
import { SoundManager } from '../core/SoundManager';

export type AuthModalTab = 'login' | 'register';

export class AuthModal {
  private readonly modalElement: HTMLElement | null;
  private readonly closeBtn: HTMLButtonElement | null;
  private readonly tabLoginBtn: HTMLButtonElement | null;
  private readonly tabRegisterBtn: HTMLButtonElement | null;
  private readonly titleElement: HTMLElement | null;
  private readonly formElement: HTMLFormElement | null;
  private readonly usernameInput: HTMLInputElement | null;
  private readonly passwordInput: HTMLInputElement | null;
  private readonly submitBtn: HTMLButtonElement | null;
  private readonly guestBtn: HTMLButtonElement | null;
  private readonly feedbackElement: HTMLElement | null;
  private readonly viewForm: HTMLElement | null;
  private readonly viewAccount: HTMLElement | null;
  private readonly accountUsername: HTMLElement | null;
  private readonly logoutBtn: HTMLButtonElement | null;
  private readonly accountCloseBtn: HTMLButtonElement | null;

  private currentTab: AuthModalTab = 'login';
  private isSubmitting = false;
  private onAuthChangedCallback?: () => void;

  constructor(onAuthChanged?: () => void) {
    this.onAuthChangedCallback = onAuthChanged;

    this.modalElement = document.getElementById('auth-modal');
    this.closeBtn = document.getElementById('auth-close-btn') as HTMLButtonElement | null;
    this.tabLoginBtn = document.getElementById('auth-tab-login') as HTMLButtonElement | null;
    this.tabRegisterBtn = document.getElementById('auth-tab-register') as HTMLButtonElement | null;
    this.titleElement = document.getElementById('auth-modal-title');
    this.formElement = document.getElementById('auth-form') as HTMLFormElement | null;
    this.usernameInput = document.getElementById('auth-input-username') as HTMLInputElement | null;
    this.passwordInput = document.getElementById('auth-input-password') as HTMLInputElement | null;
    this.submitBtn = document.getElementById('auth-submit-btn') as HTMLButtonElement | null;
    this.guestBtn = document.getElementById('auth-guest-btn') as HTMLButtonElement | null;
    this.feedbackElement = document.getElementById('auth-feedback');
    this.viewForm = document.getElementById('auth-view-form');
    this.viewAccount = document.getElementById('auth-view-account');
    this.accountUsername = document.getElementById('auth-account-username');
    this.logoutBtn = document.getElementById('auth-logout-btn') as HTMLButtonElement | null;
    this.accountCloseBtn = document.getElementById('auth-account-close-btn') as HTMLButtonElement | null;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.closeBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.hide();
    });

    this.accountCloseBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.hide();
    });

    this.guestBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.hide();
    });

    this.tabLoginBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.switchTab('login');
    });

    this.tabRegisterBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.switchTab('register');
    });

    this.formElement?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.logoutBtn?.addEventListener('click', async () => {
      SoundManager.playButtonSound();
      await AuthManager.logout();
      this.onAuthChangedCallback?.();
      this.switchTab('login');
      this.updateViewMode();
      this.showFeedback('Déconnexion réussie. Vous êtes repassé en Mode Invité.', 'success');
    });

    // Fermeture avec la touche Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.hide();
      }
    });

    // Fermeture en cliquant sur l'arrière-plan du modal
    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.hide();
      }
    });
  }

  public show(initialTab: AuthModalTab = 'login'): void {
    this.currentTab = initialTab;
    this.clearFeedback();
    this.updateViewMode();
    this.switchTab(initialTab);
    this.modalElement?.classList.remove('hidden');

    // Focus sur le champ pseudonyme si formulaire affiché
    if (!AuthManager.isLoggedIn() && this.usernameInput) {
      setTimeout(() => this.usernameInput?.focus(), 50);
    }
  }

  public hide(): void {
    this.modalElement?.classList.add('hidden');
    this.clearFeedback();
  }

  public isOpen(): boolean {
    return Boolean(this.modalElement && !this.modalElement.classList.contains('hidden'));
  }

  public switchTab(tab: AuthModalTab): void {
    this.currentTab = tab;
    this.clearFeedback();

    if (tab === 'login') {
      this.tabLoginBtn?.classList.add('active');
      this.tabRegisterBtn?.classList.remove('active');
      if (this.submitBtn) {
        this.submitBtn.textContent = 'SE CONNECTER';
      }
      if (this.titleElement) {
        this.titleElement.textContent = 'CONNEXION À LA CITADELLE';
      }
    } else {
      this.tabRegisterBtn?.classList.add('active');
      this.tabLoginBtn?.classList.remove('active');
      if (this.submitBtn) {
        this.submitBtn.textContent = 'CRÉER UN COMPTE';
      }
      if (this.titleElement) {
        this.titleElement.textContent = 'NOUVEL AVENTURIER (INSCRIPTION)';
      }
    }
  }

  private updateViewMode(): void {
    const isLogged = AuthManager.isLoggedIn();
    const user = AuthManager.getUser();

    if (isLogged && user) {
      this.viewForm?.classList.add('hidden');
      this.viewAccount?.classList.remove('hidden');
      if (this.accountUsername) {
        this.accountUsername.textContent = user.username;
      }
      if (this.titleElement) {
        this.titleElement.textContent = 'MON COMPTE D\'AVENTURIER';
      }
    } else {
      this.viewAccount?.classList.add('hidden');
      this.viewForm?.classList.remove('hidden');
    }
  }

  private async handleSubmit(): Promise<void> {
    if (this.isSubmitting) return;

    const username = this.usernameInput?.value?.trim() ?? '';
    const password = this.passwordInput?.value ?? '';

    if (!username) {
      this.showFeedback('Veuillez entrer votre nom d\'aventurier.', 'error');
      this.usernameInput?.focus();
      return;
    }

    if (!password) {
      this.showFeedback('Veuillez renseigner votre mot de passe.', 'error');
      this.passwordInput?.focus();
      return;
    }

    this.isSubmitting = true;
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = 'COMMUNICATION AVEC LA CITADELLE...';
    }

    try {
      let result: { success: boolean; error?: string };

      if (this.currentTab === 'login') {
        result = await AuthManager.login(username, password);
      } else {
        result = await AuthManager.register(username, password);
      }

      if (result.success) {
        SoundManager.playButtonSound();
        this.showFeedback(
          this.currentTab === 'login'
            ? 'Connexion réussie ! Vos données ont été chargées.'
            : 'Inscription réussie ! Bienvenue dans la Citadelle.',
          'success'
        );
        this.onAuthChangedCallback?.();
        setTimeout(() => {
          this.hide();
          this.resetInputs();
        }, 650);
      } else {
        this.showFeedback(result.error || 'Erreur lors de l\'opération.', 'error');
      }
    } catch (err: any) {
      this.showFeedback(`Erreur inattendue : ${err.message}`, 'error');
    } finally {
      this.isSubmitting = false;
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent =
          this.currentTab === 'login' ? 'SE CONNECTER' : 'CRÉER UN COMPTE';
      }
    }
  }

  private resetInputs(): void {
    if (this.usernameInput) this.usernameInput.value = '';
    if (this.passwordInput) this.passwordInput.value = '';
  }

  private showFeedback(message: string, type: 'error' | 'success' | 'info'): void {
    if (!this.feedbackElement) return;
    this.feedbackElement.textContent = message;
    this.feedbackElement.className = `auth-feedback auth-feedback-${type}`;
    this.feedbackElement.classList.remove('hidden');
  }

  private clearFeedback(): void {
    if (!this.feedbackElement) return;
    this.feedbackElement.textContent = '';
    this.feedbackElement.classList.add('hidden');
  }
}
