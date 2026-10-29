import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

type BloodOrbState = 'flying' | 'impact';

export class BloodOrb extends Entity {
  private static flightFrames: HTMLCanvasElement[] | null = null;
  private static impactFrames: HTMLCanvasElement[] | null = null;

  public readonly damage: number;
  private state: BloodOrbState = 'flying';
  private distanceTraveled = 0;
  private animTimer = 0;
  private impactTimer = 0;

  public static readonly SPEED = 5.2;
  public static readonly MAX_DISTANCE = 18.0;
  public static readonly IMPACT_DURATION = 0.18;

  constructor(x: number, y: number, angle: number, damage = 18) {
    super(x, y, angle, 0.15);
    this.damage = damage;
    BloodOrb.ensureSpritesCreated();
  }

  public isFlying(): boolean {
    return this.active && this.state === 'flying';
  }

  public hitTarget(): void {
    if (this.state !== 'impact') {
      this.state = 'impact';
      this.impactTimer = 0;
    }
  }

  public override isFloorAnchored(): boolean {
    return false; // Vole en suspension dans l'air
  }

  public override getElevation(): number {
    return 0;
  }

  public override getScale(): number {
    if (this.state === 'impact') {
      return 0.45;
    }
    return 0.34;
  }

  public update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.animTimer += deltaTime;

    if (this.state === 'impact') {
      this.impactTimer += deltaTime;
      if (this.impactTimer >= BloodOrb.IMPACT_DURATION) {
        this.active = false;
      }
      return;
    }

    // Déplacement de l'orbe de sang
    const stepDistance = BloodOrb.SPEED * deltaTime;
    const nextX = this.x + Math.cos(this.angle) * stepDistance;
    const nextY = this.y + Math.sin(this.angle) * stepDistance;

    // Collision contre un mur, un obstacle solide (pilier protecteur) ou sortie de carte
    if (
      map.isOutOfBounds(nextX, nextY) ||
      map.isWall(nextX, nextY) ||
      map.getSolidObstacleAt(nextX, nextY, 0.15)
    ) {
      this.hitTarget();
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.distanceTraveled += stepDistance;

    if (this.distanceTraveled >= BloodOrb.MAX_DISTANCE) {
      this.active = false;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.state === 'impact') {
      const frames = BloodOrb.impactFrames;
      if (!frames || frames.length === 0) return null;
      const progress = Math.min(0.99, this.impactTimer / BloodOrb.IMPACT_DURATION);
      const index = Math.floor(progress * frames.length);
      return frames[index] ?? frames[0];
    }

    const frames = BloodOrb.flightFrames;
    if (!frames || frames.length === 0) return null;
    const frameIndex = Math.floor(this.animTimer * 10) % frames.length;
    return frames[frameIndex] ?? frames[0];
  }

  private static ensureSpritesCreated(): void {
    if (this.flightFrames && this.impactFrames) {
      return;
    }

    const size = 32;
    this.flightFrames = [
      this.createOrbCanvas(size, 0),
      this.createOrbCanvas(size, 1),
    ];

    this.impactFrames = [
      this.createImpactCanvas(size, 0),
      this.createImpactCanvas(size, 1),
    ];
  }

  /**
   * Sphère magique de sang en ébullition avec lueur cramoisie
   */
  private static createOrbCanvas(size: number, variant: number): HTMLCanvasElement {
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
        const swirl = ((x * 2 + y * 3 + variant * 5) % 4) * 0.45;

        if (dist <= 2.8) {
          ctx.fillStyle = '#fff1f2'; // Cœur blanc-rosé étincelant
        } else if (dist <= 4.8) {
          ctx.fillStyle = '#f43f5e'; // Rose vif écarlate
        } else if (dist <= 7.2 + swirl) {
          ctx.fillStyle = '#be123c'; // Carmin profond
        } else if (dist <= 9.2 + swirl * 1.2) {
          ctx.fillStyle = '#4c0519'; // Sang coagulé sombre
        } else {
          continue;
        }

        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Gouttelettes de sang tournoyantes
    ctx.fillStyle = '#f43f5e';
    const angle1 = variant === 0 ? 0.8 : 2.4;
    const angle2 = variant === 0 ? 3.9 : 5.5;
    ctx.fillRect(Math.round(center + Math.cos(angle1) * 9), Math.round(center + Math.sin(angle1) * 9), 2, 2);
    ctx.fillRect(Math.round(center + Math.cos(angle2) * 8), Math.round(center + Math.sin(angle2) * 8), 2, 2);

    return canvas;
  }

  /**
   * Éclatement de l'orbe en éclaboussure de sang
   */
  private static createImpactCanvas(size: number, stage: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    if (stage === 0) {
      // Impact initial : flash central et gouttelettes jaillissantes
      ctx.fillStyle = '#ffe4e6';
      ctx.fillRect(cx - 3, cy - 3, 7, 7);
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(cx - 6, cy - 2, 13, 5);
      ctx.fillRect(cx - 2, cy - 6, 5, 13);
      ctx.fillStyle = '#881337';
      ctx.fillRect(cx - 7, cy - 7, 3, 3);
      ctx.fillRect(cx + 4, cy - 7, 3, 3);
      ctx.fillRect(cx - 7, cy + 4, 3, 3);
      ctx.fillRect(cx + 4, cy + 4, 3, 3);
    } else {
      // Dispersion des gouttelettes
      ctx.fillStyle = '#be123c';
      ctx.fillRect(cx - 10, cy - 4, 3, 3);
      ctx.fillRect(cx + 8, cy - 5, 3, 3);
      ctx.fillRect(cx - 4, cy + 9, 3, 3);
      ctx.fillRect(cx + 6, cy + 7, 3, 3);

      ctx.fillStyle = '#4c0519';
      ctx.fillRect(cx - 2, cy - 2, 5, 5);
      ctx.fillRect(cx - 8, cy + 6, 2, 2);
      ctx.fillRect(cx + 7, cy - 8, 2, 2);
    }

    return canvas;
  }
}
