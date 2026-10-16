export class InteractionPrompt {
  private readonly element: HTMLElement | null;
  private currentText: string | null = null;
  private notificationText: string | null = null;
  private notificationTimer = 0;

  constructor() {
    this.element = document.getElementById('interaction-prompt');
  }

  public update(deltaTime: number): void {
    if (this.notificationTimer > 0) {
      this.notificationTimer = Math.max(0, this.notificationTimer - deltaTime);
      if (this.notificationTimer === 0) {
        this.notificationText = null;
      }
    }
  }

  public showNotification(message: string, durationSeconds = 2.6): void {
    this.notificationText = message;
    this.notificationTimer = durationSeconds;
    this.renderText(this.notificationText);
  }

  public setPrompt(text: string | null): void {
    const displayedText = text ?? this.notificationText;
    this.renderText(displayedText);
  }

  public clear(): void {
    this.notificationText = null;
    this.notificationTimer = 0;
    this.renderText(null);
  }

  private renderText(text: string | null): void {
    if (this.currentText === text) {
      return;
    }

    this.currentText = text;

    if (!this.element) {
      return;
    }

    if (text) {
      this.element.textContent = text;
      this.element.classList.remove('hidden');
    } else {
      this.element.textContent = '';
      this.element.classList.add('hidden');
    }
  }
}
