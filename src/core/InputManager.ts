export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keyPressed = new Map<string, boolean>();
  private readonly justPressedKeys = new Set<string>();
  private mouseDeltaX = 0;
  private mouseLeftDown = false;
  private paused = false;
  private lastPointerUnlockTime = 0;
  private readonly onPauseChange?: (paused: boolean) => void;

  private readonly handleKeyEvent: (e: KeyboardEvent) => void;
  private readonly handleMouseMove: (e: MouseEvent) => void;
  private readonly handleMouseDown: (e: MouseEvent) => void;
  private readonly handleMouseUp: (e: MouseEvent) => void;
  private readonly handlePointerLockChange: () => void;

  constructor(canvas: HTMLCanvasElement, onPauseChange?: (paused: boolean) => void) {
    this.canvas = canvas;
    this.onPauseChange = onPauseChange;

    this.handleKeyEvent = (e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.key === 'Escape') {
        // Évite un double déclenchement si la sortie du PointerLock vient déjà d'ouvrir le menu
        if (performance.now() - this.lastPointerUnlockTime < 150) {
          return;
        }
        this.setPaused(!this.paused);
        return;
      }

      if (this.paused) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.type === 'keydown') {
        if (!e.repeat && !this.keyPressed.get(key)) {
          this.justPressedKeys.add(key);
        }
        this.keyPressed.set(key, true);
      } else if (e.type === 'keyup') {
        this.keyPressed.set(key, false);
        this.justPressedKeys.delete(key);
      }
    };

    this.handleMouseMove = (e: MouseEvent) => {
      if (this.paused) {
        return;
      }
      this.mouseDeltaX += e.movementX;
    };

    this.handleMouseDown = (e: MouseEvent) => {
      if (this.paused) {
        return;
      }

      if (document.pointerLockElement !== this.canvas) {
        this.lockPointer();
      }

      if (e.button === 0) {
        this.mouseLeftDown = true;
      }
    };

    this.handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseLeftDown = false;
      }
    };

    this.handlePointerLockChange = () => {
      if (document.pointerLockElement !== this.canvas && !this.paused) {
        // Le navigateur a libéré le curseur (touche Échap pressée pendant le PointerLock)
        this.lastPointerUnlockTime = performance.now();
        this.setPaused(true);
      }
    };

    document.addEventListener('keydown', this.handleKeyEvent);
    document.addEventListener('keyup', this.handleKeyEvent);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }

    this.paused = paused;
    this.keyPressed.clear();
    this.justPressedKeys.clear();
    this.mouseLeftDown = false;
    this.mouseDeltaX = 0;

    if (paused) {
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    } else {
      this.lockPointer();
    }

    this.onPauseChange?.(paused);
  }

  public lockPointer(): void {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  public isKeyDown(key: string): boolean {
    if (this.paused) {
      return false;
    }
    const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
    return this.keyPressed.get(normalizedKey) === true;
  }

  /**
   * Renvoie true une seule fois lorsque la touche vient d'être pressée
   */
  public consumeKeyPress(key: string): boolean {
    if (this.paused) {
      return false;
    }
    const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
    if (this.justPressedKeys.has(normalizedKey)) {
      this.justPressedKeys.delete(normalizedKey);
      return true;
    }
    return false;
  }

  public isMouseLeftDown(): boolean {
    return !this.paused && this.mouseLeftDown;
  }

  /**
   * Récupère le déplacement horizontal de la souris depuis la dernière frame et le remet à zéro
   */
  public consumeMouseDeltaX(): number {
    if (this.paused) {
      return 0;
    }
    const delta = this.mouseDeltaX;
    this.mouseDeltaX = 0;
    return delta;
  }

  public destroy(): void {
    document.removeEventListener('keydown', this.handleKeyEvent);
    document.removeEventListener('keyup', this.handleKeyEvent);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.keyPressed.clear();
  }
}
