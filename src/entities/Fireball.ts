import { FIREBALL_CONFIG } from '../config/constants';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

type FireballState = 'flying' | 'exploding';

export class Fireball extends Entity {
  private static flightFrames: HTMLCanvasElement[] | null = null;
  private static explosionFrames: HTMLCanvasElement[] | null = null;

  public readonly damage: number;
  private state: FireballState = 'flying';
  private distanceTraveled = 0;
  private animTimer = 0;
  private explosionTimer = 0;

  constructor(x: number, y: number, angle: number, damage = 14) {
    super(x, y, angle, 0.1);
    this.damage = damage;
    Fireball.ensureSpritesCreated();
  }

  public isFlying(): boolean {
    return this.active && this.state === 'flying';
  }

  public explode(): void {
    if (this.state !== 'exploding') {
      this.state = 'exploding';
      this.explosionTimer = 0;
    }
  }

  public update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.animTimer += deltaTime;

    if (this.state === 'exploding') {
      this.explosionTimer += deltaTime;
      if (this.explosionTimer >= FIREBALL_CONFIG.EXPLOSION_DURATION) {
        this.active = false;
      }
      return;
    }

    // Déplacement de la boule de feu
    const stepDistance = FIREBALL_CONFIG.SPEED * deltaTime;
    const nextX = this.x + Math.cos(this.angle) * stepDistance;
    const nextY = this.y + Math.sin(this.angle) * stepDistance;

    // Collision avec un mur ou sortie de carte
    if (map.isOutOfBounds(nextX, nextY) || map.isWall(nextX, nextY)) {
      this.state = 'exploding';
      this.explosionTimer = 0;
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.distanceTraveled += stepDistance;

    if (this.distanceTraveled >= FIREBALL_CONFIG.MAX_DISTANCE) {
      this.active = false;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.state === 'exploding') {
      const frames = Fireball.explosionFrames!;
      const progress = Math.min(
        0.99,
        this.explosionTimer / FIREBALL_CONFIG.EXPLOSION_DURATION
      );
      const index = Math.floor(progress * frames.length);
      return frames[index];
    }

    const frames = Fireball.flightFrames!;
    const frameIndex = Math.floor(this.animTimer * 14) % frames.length;
    return frames[frameIndex];
  }

  public override getScale(): number {
    if (this.state === 'exploding') {
      return FIREBALL_CONFIG.EXPLOSION_SCALE;
    }
    return FIREBALL_CONFIG.SCALE;
  }

  private static ensureSpritesCreated(): void {
    if (this.flightFrames && this.explosionFrames) {
      return;
    }

    this.flightFrames = [
      this.createFireballFrame(16, 0),
      this.createFireballFrame(16, 1),
    ];

    this.explosionFrames = [
      this.createExplosionFrame(16, 0),
      this.createExplosionFrame(16, 1),
    ];
  }

  private static createFireballFrame(size: number, variant: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - center;
        const dy = y + 0.5 - center;
        const dist = Math.hypot(dx, dy);

        // Légère oscillation pixel-art sur le contour extérieur
        const flicker = ((x + y + variant) % 2) * 0.6;

        if (dist <= 2.3) {
          ctx.fillStyle = '#fffbe0'; // Cœur blanc-jaune incandescent
        } else if (dist <= 4.2) {
          ctx.fillStyle = '#ffcf24'; // Jaune vif
        } else if (dist <= 5.8 + flicker * 0.4) {
          ctx.fillStyle = '#ff6a00'; // Orange ardent
        } else if (dist <= 7.0 + flicker) {
          ctx.fillStyle = '#cc1b00'; // Bord rouge feu
        } else {
          continue;
        }

        ctx.fillRect(x, y, 1, 1);
      }
    }

    return canvas;
  }

  private static createExplosionFrame(size: number, stage: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - center;
        const dy = y + 0.5 - center;
        const dist = Math.hypot(dx, dy);
        const pattern = ((x * 3 + y * 5 + stage) % 3) * 0.8;

        if (stage === 0) {
          if (dist <= 3.5) {
            ctx.fillStyle = '#ffffff';
          } else if (dist <= 5.8 + pattern * 0.5) {
            ctx.fillStyle = '#ffae00';
          } else if (dist <= 7.5 + pattern) {
            ctx.fillStyle = '#e02800';
          } else {
            continue;
          }
        } else {
          // Étape 2 : anneau de fumée et braises qui se dissipe
          if (dist >= 2.2 && dist <= 5.5 + pattern * 0.5) {
            ctx.fillStyle = '#ff5500';
          } else if (dist > 5.5 && dist <= 7.8 + pattern) {
            ctx.fillStyle = '#5c180c';
          } else {
            continue;
          }
        }

        ctx.fillRect(x, y, 1, 1);
      }
    }

    return canvas;
  }
}
