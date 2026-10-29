import { PURPLE_ORB_CONFIG } from '../config/constants';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';

type PurpleOrbState = 'flying' | 'exploding';

export class PurpleOrb extends Entity {
  private static flightFrames: HTMLCanvasElement[] | null = null;
  private static explosionFrames: HTMLCanvasElement[] | null = null;

  public readonly baseDamage: number;
  public readonly shooterId?: string;
  public bouncesRemaining: number;
  public bouncesDone = 0;
  private state: PurpleOrbState = 'flying';
  private lifetime = 0;
  private animTimer = 0;
  private explosionTimer = 0;

  public get damage(): number {
    const multiplier = 1 + this.bouncesDone * PURPLE_ORB_CONFIG.BOUNCE_DAMAGE_MULTIPLIER;
    return Math.round(this.baseDamage * multiplier);
  }

  constructor(
    x: number,
    y: number,
    angle: number,
    damage: number = PURPLE_ORB_CONFIG.DAMAGE,
    maxBounces: number = PURPLE_ORB_CONFIG.MAX_BOUNCES,
    shooterId?: string
  ) {
    super(x, y, angle, PURPLE_ORB_CONFIG.HITBOX);
    this.baseDamage = damage;
    this.bouncesRemaining = maxBounces;
    this.shooterId = shooterId;
    PurpleOrb.ensureSpritesCreated();
  }

  public isFlying(): boolean {
    return this.active && this.state === 'flying';
  }

  public canDamageSelf(): boolean {
    return (
      this.bouncesDone > 0 ||
      this.lifetime >= PURPLE_ORB_CONFIG.SELF_DAMAGE_MIN_LIFETIME
    );
  }

  public explode(): void {
    if (this.state !== 'exploding') {
      this.state = 'exploding';
      this.explosionTimer = 0;
    }
  }

  public override update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.animTimer += deltaTime;

    if (this.state === 'exploding') {
      this.explosionTimer += deltaTime;
      if (this.explosionTimer >= PURPLE_ORB_CONFIG.EXPLOSION_DURATION) {
        this.active = false;
      }
      return;
    }

    this.lifetime += deltaTime;
    if (this.lifetime >= PURPLE_ORB_CONFIG.MAX_LIFETIME) {
      this.explode();
      return;
    }

    const stepDist = PURPLE_ORB_CONFIG.SPEED * deltaTime;
    let vx = Math.cos(this.angle) * stepDist;
    let vy = Math.sin(this.angle) * stepDist;

    const r = this.hitBox;

    // 1. Rebond physique sur les piliers (obstacles réflecteurs circulaires)
    const bouncingPillar = map.getBouncingObstacleAt(this.x + vx, this.y + vy, r);
    if (bouncingPillar) {
      const dx = this.x + vx - bouncingPillar.x;
      const dy = this.y + vy - bouncingPillar.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // Réflexion spéculaire : v' = v - 2 * (v · n) * n
      const currentVx = Math.cos(this.angle);
      const currentVy = Math.sin(this.angle);
      const dot = currentVx * nx + currentVy * ny;

      if (dot < 0) {
        const rx = currentVx - 2 * dot * nx;
        const ry = currentVy - 2 * dot * ny;
        this.angle = Math.atan2(ry, rx) + (Math.random() - 0.5) * 0.05;

        this.bouncesDone++;
        this.bouncesRemaining--;

        // Repousse l'orbe hors de la surface du pilier pour garantir un décollement franc
        this.x = bouncingPillar.x + nx * (bouncingPillar.radius + r + 0.02);
        this.y = bouncingPillar.y + ny * (bouncingPillar.radius + r + 0.02);

        if (this.bouncesRemaining <= 0) {
          this.explode();
          return;
        }

        return;
      }
    }

    // 2. Détonation contre les obstacles solides non-réfléchissants (tonneaux, caisses, tables)
    const solidObstacle = map.getSolidObstacleAt(this.x + vx, this.y + vy, r);
    if (solidObstacle && !solidObstacle.bouncesProjectiles) {
      this.explode();
      return;
    }

    // 3. Test de collision sur les murs orthogonaux
    let bouncedX = false;
    let bouncedY = false;

    // Test de collision sur l'axe X (face verticale de mur)
    const testX = vx > 0 ? this.x + vx + r : this.x + vx - r;
    if (map.isOutOfBounds(testX, this.y) || map.isWall(testX, this.y)) {
      bouncedX = true;
    }

    // Test de collision sur l'axe Y (face horizontale de mur)
    const testY = vy > 0 ? this.y + vy + r : this.y + vy - r;
    if (map.isOutOfBounds(this.x, testY) || map.isWall(this.x, testY)) {
      bouncedY = true;
    }

    if (bouncedX || bouncedY) {
      if (bouncedX) {
        this.angle = Math.atan2(Math.sin(this.angle), -Math.cos(this.angle));
      }
      if (bouncedY) {
        this.angle = Math.atan2(-Math.sin(this.angle), Math.cos(this.angle));
      }

      // Petite déviation aléatoire (±1.5°) pour éviter les cycles de rebonds parfaitement infinis
      this.angle += (Math.random() - 0.5) * 0.05;

      this.bouncesDone++;
      this.bouncesRemaining--;

      if (this.bouncesRemaining <= 0) {
        this.explode();
        return;
      }

      // Recalcul du vecteur après réflexion
      vx = Math.cos(this.angle) * stepDist;
      vy = Math.sin(this.angle) * stepDist;
    }

    const nextX = this.x + vx;
    const nextY = this.y + vy;

    // Sécurité : si on pénètre dans un mur solide malgré le rebond, détonation immédiate
    if (
      map.isOutOfBounds(nextX, nextY) ||
      map.isWall(nextX, nextY) ||
      map.getSolidObstacleAt(nextX, nextY, r)
    ) {
      this.explode();
      return;
    }

    this.x = nextX;
    this.y = nextY;
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.state === 'exploding') {
      const frames = PurpleOrb.explosionFrames!;
      const progress = Math.min(
        0.99,
        this.explosionTimer / PURPLE_ORB_CONFIG.EXPLOSION_DURATION
      );
      const index = Math.floor(progress * frames.length);
      return frames[index];
    }

    const frames = PurpleOrb.flightFrames!;
    const spinSpeed = 12 + this.bouncesDone * 5;
    const frameIndex = Math.floor(this.animTimer * spinSpeed) % frames.length;
    return frames[frameIndex];
  }

  public override getScale(): number {
    const powerScale = Math.min(0.65, this.bouncesDone * 0.12);
    if (this.state === 'exploding') {
      return PURPLE_ORB_CONFIG.EXPLOSION_SCALE * (1 + powerScale);
    }
    return PURPLE_ORB_CONFIG.SCALE * (1 + powerScale);
  }

  private static ensureSpritesCreated(): void {
    if (this.flightFrames && this.explosionFrames) {
      return;
    }

    this.flightFrames = [
      this.createOrbFrame(18, 0),
      this.createOrbFrame(18, 1),
      this.createOrbFrame(18, 2),
      this.createOrbFrame(18, 3),
    ];

    this.explosionFrames = [
      this.createExplosionFrame(22, 0),
      this.createExplosionFrame(22, 1),
      this.createExplosionFrame(22, 2),
    ];
  }

  private static createOrbFrame(size: number, frame: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    const angleOffset = frame * (Math.PI / 2);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - center;
        const dy = y + 0.5 - center;
        const dist = Math.hypot(dx, dy);
        const pixelAngle = Math.atan2(dy, dx);

        // Rayonnement magique tourbillonnant
        const spiral = Math.sin(pixelAngle * 3 + angleOffset + dist * 0.8) * 0.7;

        if (dist <= 2.2) {
          ctx.fillStyle = '#ffffff'; // Cœur blanc étincelant
        } else if (dist <= 3.8 + spiral * 0.3) {
          ctx.fillStyle = '#f5d0fe'; // Lueur violette claire / lilas
        } else if (dist <= 5.4 + spiral * 0.5) {
          ctx.fillStyle = '#d946ef'; // Magenta fuchsia éclatant
        } else if (dist <= 6.8 + spiral) {
          ctx.fillStyle = '#7e22ce'; // Pourpre violet mystique
        } else if (dist <= 7.8) {
          ctx.fillStyle = '#3b0764'; // Contour sombre arcanique
        } else {
          continue;
        }

        ctx.fillRect(x, y, 1, 1);
      }
    }

    // 4 Étincelles orbitales en rotation
    for (let i = 0; i < 4; i++) {
      const sparkAngle = angleOffset + (i * Math.PI) / 2;
      const sparkDist = 7.0 + Math.sin(angleOffset * 2 + i) * 0.8;
      const sx = Math.round(center + Math.cos(sparkAngle) * sparkDist - 0.5);
      const sy = Math.round(center + Math.sin(sparkAngle) * sparkDist - 0.5);
      if (sx >= 0 && sx < size && sy >= 0 && sy < size) {
        ctx.fillStyle = i % 2 === 0 ? '#fae8ff' : '#e879f9';
        ctx.fillRect(sx, sy, 1, 1);
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
        const noise = ((x * 7 + y * 13 + stage * 5) % 5) * 0.5;

        if (stage === 0) {
          // Éclat initial nova
          if (dist <= 3.5) {
            ctx.fillStyle = '#ffffff';
          } else if (dist <= 6.0 + noise) {
            ctx.fillStyle = '#f0abfc';
          } else if (dist <= 8.5 + noise * 1.2) {
            ctx.fillStyle = '#a855f7';
          } else if (dist <= 10.0 + noise) {
            ctx.fillStyle = '#581c87';
          }
        } else if (stage === 1) {
          // Anneau d'onde de choc violette en expansion
          if (dist >= 3.0 && dist <= 7.5 + noise) {
            ctx.fillStyle = '#e879f9';
          } else if (dist > 7.5 && dist <= 10.0 + noise * 1.2) {
            ctx.fillStyle = '#9333ea';
          } else if (dist > 10.0 && dist <= 11.0) {
            ctx.fillStyle = '#3b0764';
          }
        } else {
          // Particules résiduelles et dissipation
          if (dist >= 4.0 && dist <= 9.5 + noise && (x + y) % 2 === 0) {
            ctx.fillStyle = '#7e22ce';
          } else if (dist > 9.5 && dist <= 11.5 && (x * y) % 3 === 0) {
            ctx.fillStyle = '#2e1065';
          }
        }

        if (ctx.fillStyle) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    return canvas;
  }
}
