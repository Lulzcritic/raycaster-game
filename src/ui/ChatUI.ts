/**
 * Interface du Chat d'escouade et du fil d'actualité en temps réel (Phase 4).
 * Gère l'envoi de messages avec la touche Entrée, l'affichage rétro des messages,
 * les annonces système (butin, extractions, boss, pings) et l'estompage automatique.
 */
export class ChatUI {
  private container: HTMLElement | null = null;
  private messagesList: HTMLElement | null = null;
  private inputBar: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;

  private isChatOpen = false;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private onSendMessageCallback?: (text: string) => void;

  constructor(onSendMessage?: (text: string) => void) {
    this.onSendMessageCallback = onSendMessage;
    this.buildDOM();
    this.setupListeners();
  }

  private buildDOM(): void {
    let container = document.getElementById('chat-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'chat-container';
      container.className = 'chat-container hidden';

      const messagesList = document.createElement('div');
      messagesList.id = 'chat-messages';
      messagesList.className = 'chat-messages';
      container.appendChild(messagesList);

      const inputBar = document.createElement('div');
      inputBar.id = 'chat-input-bar';
      inputBar.className = 'chat-input-bar hidden';

      const input = document.createElement('input');
      input.id = 'chat-input';
      input.className = 'chat-input';
      input.type = 'text';
      input.maxLength = 120;
      input.placeholder = "Message à l'escouade... (Entrée pour envoyer, Échap pour annuler)";
      inputBar.appendChild(input);

      container.appendChild(inputBar);
      document.body.appendChild(container);
    }

    this.container = container;
    this.messagesList = document.getElementById('chat-messages');
    this.inputBar = document.getElementById('chat-input-bar');
    this.inputEl = document.getElementById('chat-input') as HTMLInputElement | null;
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (this.container?.classList.contains('hidden')) {
        return;
      }

      if (e.key === 'Enter') {
        if (!this.isChatOpen) {
          // Ouverture du champ de saisie
          e.preventDefault();
          this.openInput();
        } else {
          // Envoi du message
          e.preventDefault();
          this.submitMessage();
        }
      } else if (e.key === 'Escape' && this.isChatOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.closeInput();
      }
    });
  }

  public openInput(): void {
    this.isChatOpen = true;
    this.inputBar?.classList.remove('hidden');
    this.messagesList?.classList.remove('faded');
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.focus();
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public closeInput(): void {
    this.isChatOpen = false;
    this.inputBar?.classList.add('hidden');
    if (this.inputEl) {
      this.inputEl.blur();
    }
    this.resetFadeTimer();
  }

  private submitMessage(): void {
    const text = this.inputEl?.value.trim();
    if (text && text.length > 0) {
      this.onSendMessageCallback?.(text);
    }
    this.closeInput();
  }

  public addMessage(
    senderName: string,
    text: string,
    isSystem = false,
    badgeColor?: string
  ): void {
    if (!this.messagesList) return;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message-line${isSystem ? ' is-system' : ''}`;

    if (isSystem) {
      msgEl.innerHTML = `<span class="chat-system-tag">🔔 CITADELLE</span> <span class="chat-system-text">${text}</span>`;
    } else {
      const colorStyle = badgeColor ? ` style="color: ${badgeColor}; border-color: ${badgeColor}"` : '';
      msgEl.innerHTML = `<span class="chat-sender-name"${colorStyle}>[${senderName}]</span> <span class="chat-message-text">${text}</span>`;
    }

    this.messagesList.appendChild(msgEl);
    this.messagesList.scrollTop = this.messagesList.scrollHeight;

    // Réinitialise la visibilité et le compte à rebours d'estompage
    this.messagesList.classList.remove('faded');
    this.resetFadeTimer();
  }

  private resetFadeTimer(): void {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
    }
    if (this.isChatOpen) {
      return;
    }
    this.fadeTimer = setTimeout(() => {
      this.messagesList?.classList.add('faded');
    }, 7000);
  }

  public show(): void {
    this.container?.classList.remove('hidden');
    this.resetFadeTimer();
  }

  public hide(): void {
    this.closeInput();
    this.container?.classList.add('hidden');
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  public clear(): void {
    if (this.messagesList) {
      this.messagesList.innerHTML = '';
    }
    this.closeInput();
  }

  public isTyping(): boolean {
    return this.isChatOpen;
  }
}
