import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

type WaveState = 'flying' | 'impact';

export class BloodWaveSegment extends Entity {
  private static waveFrames: HTMLCanvasElement[] | null = null;
  private static impactFrames: HTMLCanvasElement[] | null = null;

  public readonly damage: number;
  public readonly waveId: number;
  private state: WaveState = 'flying';
  private distanceTraveled = 0;
  private animTimer = 0;
  private impactTimer = 0;

  public static readonly SPEED = 6.8;
  public static readonly MAX_DISTANCE = 22.0;
  public static readonly IMPACT_DURATION = 0.16;

  constructor(
    x: number,
    y: number,
    angle: number,
    damage = 42,
    waveId = Date.now()
  ) {
    super(x, y, angle, 0.22);
    this.damage = damage;
    this.waveId = waveId;
    BloodWaveSegment.ensureSpritesCreated();
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
    return false;
  }

  public override getElevation(): number {
    return 0;
  }

  public override getScale(): number {
    if (this.state === 'impact') {
      return 0.52;
    }
    return 0.46;
  }

  public update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.animTimer += deltaTime;

    if (this.state === 'impact') {
      this.impactTimer += deltaTime;
      if (this.impactTimer >= BloodWaveSegment.IMPACT_DURATION) {
        this.active = false;
      }
      return;
    }

    // Progression de l'onde
    const stepDistance = BloodWaveSegment.SPEED * deltaTime;
    const nextX = this.x + Math.cos(this.angle) * stepDistance;
    const nextY = this.y + Math.sin(this.angle) * stepDistance;

    // Arrêt immédiat contre les murs ou piliers : offre un abri absolu au joueur !
    if (map.isOutOfBounds(nextX, nextY) || map.isWall(nextX, nextY)) {
      this.hitTarget();
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.distanceTraveled += stepDistance;

    if (this.distanceTraveled >= BloodWaveSegment.MAX_DISTANCE) {
      this.active = false;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.state === 'impact') {
      const frames = BloodWaveSegment.impactFrames;
      if (!frames || frames.length === 0) return null;
      const progress = Math.min(0.99, this.impactTimer / BloodWaveSegment.IMPACT_DURATION);
      const index = Math.floor(progress * frames.length);
      return frames[index] ?? frames[0];
    }

    const frames = BloodWaveSegment.waveFrames;
    if (!frames || frames.length === 0) return null;
    const frameIndex = Math.floor(this.animTimer * 12) % frames.length;
    return frames[frameIndex] ?? frames[0];
  }

  private static ensureSpritesCreated(): void {
    if (this.waveFrames && this.impactFrames) {
      return;
    }

    const size = 32;
    this.waveFrames = [
      this.createWaveCanvas(size, 0),
      this.createWaveCanvas(size, 1),
    ];

    this.impactFrames = [
      this.createImpactCanvas(size, 0),
      this.createImpactCanvas(size, 1),
    ];
  }

  /**
   * Crête d'onde de sang incurvée, écume cramoisie et lueur dévastatrice
   */
  private static createWaveCanvas(size: number, variant: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    const flicker = variant === 0 ? 0 : 1;

    // Corps de l'onde : arc de cercle horizontal dense
    // 1. Lueur d'énergie sanguine extérieure
    ctx.fillStyle = '#ff80ab';
    ctx.fillRect(cx - 12 + flicker, cy - 6, 24, 2);
    ctx.fillRect(cx - 14, cy - 4, 28, 2);

    // 2. Crête écarlate vive
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(cx - 13, cy - 2, 26, 3);
    ctx.fillRect(cx - 11, cy + 1, 22, 3);

    // 3. Cœur dense carmin sombre
    ctx.fillStyle = '#880e4f';
    ctx.fillRect(cx - 9, cy + 4, 18, 2);
    ctx.fillRect(cx - 6, cy + 6, 12, 2);

    // 4. Écume incandescente au sommet
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 8, cy - 4, 3, 1);
    ctx.fillRect(cx + 4, cy - 4, 4, 1);
    ctx.fillRect(cx - 1, cy - 5, 2, 1);

    // 5. Gouttelettes traînantes
    ctx.fillStyle = '#d50000';
    ctx.fillRect(cx - 11, cy + 7, 2, 2);
    ctx.fillRect(cx + 8, cy + 6, 2, 2);
    ctx.fillRect(cx - 3, cy + 8, 2, 2);

    return canvas;
  }

  private static createImpactCanvas(size: number, stage: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    if (stage === 0) {
      // Déferlante qui s'écrase contre la surface
      ctx.fillStyle = '#ff80ab';
      ctx.fillRect(cx - 10, cy - 4, 20, 8);
      ctx.fillStyle = '#d50000';
      ctx.fillRect(cx - 14, cy - 2, 28, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 4, cy - 6, 8, 3);
    } else {
      // Éclaboussures qui ruissellent
      ctx.fillStyle = '#880e4f';
      ctx.fillRect(cx - 12, cy - 2, 4, 8);
      ctx.fillRect(cx + 8, cy - 3, 4, 9);
      ctx.fillRect(cx - 2, cy - 5, 4, 12);
      ctx.fillStyle = '#4c0519';
      ctx.fillRect(cx - 8, cy + 4, 16, 4);
    }

    return canvas;
  }
}
