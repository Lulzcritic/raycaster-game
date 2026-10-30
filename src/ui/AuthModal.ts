import { AuthManager } from '../core/AuthManager';
import { SoundManager } from '../core/SoundManager';
import { I18nService } from '../core/I18nService';

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
      const isFr = I18nService.getCurrentLanguage() === 'fr';
      this.showFeedback(
        isFr
          ? 'Déconnexion réussie. Vous êtes repassé en Mode Invité.'
          : 'Logged out successfully. You returned to Guest Mode.',
        'success'
      );
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
    if (this.modalElement) {
      this.modalElement.classList.remove('hidden');
      this.modalElement.style.display = 'flex';
    }

    // Focus sur le champ pseudonyme si formulaire affiché
    if (!AuthManager.isLoggedIn() && this.usernameInput) {
      setTimeout(() => this.usernameInput?.focus(), 50);
    }
  }

  public hide(): void {
    if (this.modalElement) {
      this.modalElement.classList.add('hidden');
      this.modalElement.style.display = 'none';
    }
    this.clearFeedback();
  }

  public isOpen(): boolean {
    return Boolean(this.modalElement && !this.modalElement.classList.contains('hidden'));
  }

  public switchTab(tab: AuthModalTab): void {
    this.currentTab = tab;
    this.clearFeedback();
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (tab === 'login') {
      this.tabLoginBtn?.classList.add('active');
      this.tabRegisterBtn?.classList.remove('active');
      if (this.submitBtn) {
        this.submitBtn.textContent = isFr ? 'SE CONNECTER' : 'LOG IN';
      }
      if (this.titleElement) {
        this.titleElement.textContent = isFr ? 'CONNEXION À LA CITADELLE' : 'CITADEL LOGIN';
      }
    } else {
      this.tabRegisterBtn?.classList.add('active');
      this.tabLoginBtn?.classList.remove('active');
      if (this.submitBtn) {
        this.submitBtn.textContent = isFr ? 'CRÉER UN COMPTE' : 'CREATE AN ACCOUNT';
      }
      if (this.titleElement) {
        this.titleElement.textContent = isFr ? 'NOUVEL AVENTURIER (INSCRIPTION)' : 'NEW ADVENTURER (SIGN UP)';
      }
    }
  }

  private updateViewMode(): void {
    const isLogged = AuthManager.isLoggedIn();
    const user = AuthManager.getUser();
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (isLogged && user) {
      this.viewForm?.classList.add('hidden');
      this.viewAccount?.classList.remove('hidden');
      if (this.accountUsername) {
        this.accountUsername.textContent = user.username;
      }
      if (this.titleElement) {
        this.titleElement.textContent = isFr ? "MON COMPTE D'AVENTURIER" : 'MY ADVENTURER ACCOUNT';
      }
    } else {
      this.viewAccount?.classList.add('hidden');
      this.viewForm?.classList.remove('hidden');
    }
  }

  private async handleSubmit(): Promise<void> {
    if (this.isSubmitting) return;

    const isFr = I18nService.getCurrentLanguage() === 'fr';
    const username = this.usernameInput?.value?.trim() ?? '';
    const password = this.passwordInput?.value ?? '';

    if (!username) {
      this.showFeedback(
        isFr ? "Veuillez entrer votre nom d'aventurier." : 'Please enter your adventurer name.',
        'error'
      );
      this.usernameInput?.focus();
      return;
    }

    if (!password) {
      this.showFeedback(
        isFr ? 'Veuillez renseigner votre mot de passe.' : 'Please enter your password.',
        'error'
      );
      this.passwordInput?.focus();
      return;
    }

    this.isSubmitting = true;
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = isFr
        ? 'COMMUNICATION AVEC LA CITADELLE...'
        : 'COMMUNICATING WITH CITADEL...';
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
            ? (isFr ? 'Connexion réussie ! Vos données ont été chargées.' : 'Login successful! Profile loaded.')
            : (isFr ? 'Inscription réussie ! Bienvenue dans la Citadelle.' : 'Registration successful! Welcome to the Citadel.'),
          'success'
        );
        this.onAuthChangedCallback?.();
        setTimeout(() => {
          this.hide();
          this.resetInputs();
        }, 650);
      } else {
        this.showFeedback(result.error || (isFr ? "Erreur lors de l'opération." : 'Operation failed.'), 'error');
      }
    } catch (err: any) {
      this.showFeedback(`${isFr ? 'Erreur inattendue' : 'Unexpected error'} : ${err.message}`, 'error');
    } finally {
      this.isSubmitting = false;
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent =
          this.currentTab === 'login'
            ? (isFr ? 'SE CONNECTER' : 'LOG IN')
            : (isFr ? 'CRÉER UN COMPTE' : 'CREATE AN ACCOUNT');
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
