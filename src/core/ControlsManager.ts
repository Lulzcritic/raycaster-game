export type KeyboardLayout = 'qwerty' | 'azerty';

export interface KeyBindings {
  readonly MOVE_FORWARD: string;
  readonly MOVE_BACKWARD: string;
  readonly STRAFE_LEFT: string;
  readonly STRAFE_RIGHT: string;
  readonly TURN_LEFT: string;
  readonly TURN_RIGHT: string;
  readonly SHOOT: string;
  readonly INTERACT: string;
  readonly PING: string;
}

export const LAYOUT_BINDINGS: Record<KeyboardLayout, KeyBindings> = {
  qwerty: {
    MOVE_FORWARD: 'w',
    MOVE_BACKWARD: 's',
    STRAFE_LEFT: 'a',
    STRAFE_RIGHT: 'd',
    TURN_LEFT: 'ArrowLeft',
    TURN_RIGHT: 'ArrowRight',
    SHOOT: ' ',
    INTERACT: 'f',
    PING: 't',
  },
  azerty: {
    MOVE_FORWARD: 'z',
    MOVE_BACKWARD: 's',
    STRAFE_LEFT: 'q',
    STRAFE_RIGHT: 'd',
    TURN_LEFT: 'ArrowLeft',
    TURN_RIGHT: 'ArrowRight',
    SHOOT: ' ',
    INTERACT: 'f',
    PING: 't',
  },
};

export class ControlsManager {
  private static readonly STORAGE_KEY = 'raycaster_keyboard_layout';
  private static currentLayout: KeyboardLayout = 'qwerty';
  private static readonly listeners = new Set<(layout: KeyboardLayout) => void>();
  private static isInitialized = false;

  public static init(): void {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved === 'azerty' || saved === 'qwerty') {
          this.currentLayout = saved;
        }
      }
    } catch {
      // Ignorer les restrictions éventuelles de localStorage
    }
  }

  public static getLayout(): KeyboardLayout {
    this.init();
    return this.currentLayout;
  }

  public static setLayout(layout: KeyboardLayout): void {
    this.init();
    if (layout !== 'qwerty' && layout !== 'azerty') {
      return;
    }
    if (this.currentLayout === layout) {
      return;
    }

    this.currentLayout = layout;

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, layout);
      }
    } catch {
      // Ignorer
    }

    this.notifyListeners();
  }

  public static toggleLayout(): KeyboardLayout {
    const nextLayout: KeyboardLayout = this.getLayout() === 'qwerty' ? 'azerty' : 'qwerty';
    this.setLayout(nextLayout);
    return nextLayout;
  }

  public static getBindings(): KeyBindings {
    return LAYOUT_BINDINGS[this.getLayout()];
  }

  public static subscribe(listener: (layout: KeyboardLayout) => void): () => void {
    this.listeners.add(listener);
    // Notifier immédiatement l'état actuel lors de l'abonnement
    try {
      listener(this.getLayout());
    } catch (err) {
      console.error('[ControlsManager] Erreur notification initiale:', err);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const layout = this.currentLayout;
    for (const listener of this.listeners) {
      try {
        listener(layout);
      } catch (err) {
        console.error('[ControlsManager] Erreur dans un abonné:', err);
      }
    }
  }

  public static getLabels(layout = this.getLayout()): {
    forwardBackward: string;
    strafe: string;
    forwardKey: string;
    backwardKey: string;
    leftKey: string;
    rightKey: string;
  } {
    if (layout === 'azerty') {
      return {
        forwardBackward: 'Z / S',
        strafe: 'Q / D',
        forwardKey: 'Z',
        backwardKey: 'S',
        leftKey: 'Q',
        rightKey: 'D',
      };
    }
    return {
      forwardBackward: 'W / S',
      strafe: 'A / D',
      forwardKey: 'W',
      backwardKey: 'S',
      leftKey: 'A',
      rightKey: 'D',
    };
  }
}
