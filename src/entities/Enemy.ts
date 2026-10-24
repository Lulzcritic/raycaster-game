import { WalletManager } from '../core/WalletManager';
import { MimicSpriteManager } from '../graphics/MimicSpriteManager';
import type { EnemyTypeDefinition } from '../types/enemy';
import type { GameMap } from '../world/GameMap';
import { DroppedCoin } from './DroppedCoin';
import { Entity } from './Entity';
import type { Player } from './Player';

export type EnemyState = 'idle' | 'aggro' | 'attacking' | 'hurt' | 'dead';

export class Enemy extends Entity {
  public readonly type: EnemyTypeDefinition;
  public health: number;
  public maxHealth: number;
  public state: EnemyState = 'idle';

  private readonly player: Player;
  private readonly onSpawnEntity?: (entity: Entity) => void;
  private readonly sprites: Record<string, HTMLCanvasElement>;

  private stateTimer = 0;
  private attackCooldownTimer = 0;
  private hopTimer = 0;
  private currentElevation = 0;
  private animTimer = 0;

  constructor(
    x: number,
    y: number,
    type: EnemyTypeDefinition,
    player: Player,
    onSpawnEntity?: (entity: Entity) => void
  ) {
    super(x, y, 0, type.hitBox);
    this.type = type;
    this.player = player;
    this.onSpawnEntity = onSpawnEntity;
    this.health = type.stats.maxHealth;
    this.maxHealth = type.stats.maxHealth;
    this.sprites = type.id === 'mimic' ? {} : Enemy.generateEnemySprites(type);
  }

  public setAttackCooldown(duration: number): void {
    this.attackCooldownTimer = duration;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    return this.currentElevation;
  }

  public override getScale(): number {
    return this.type.scale;
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.type.id === 'mimic') {
      return MimicSpriteManager.getSprite(
        this.state,
        this.animTimer,
        this.stateTimer
      );
    }

    if (this.state === 'dead') {
      return this.sprites.dead;
    }
    if (this.state === 'hurt') {
      return this.sprites.hurt;
    }
    if (this.state === 'attacking') {
      return this.sprites.attacking;
    }

    if (this.type.movementPattern === 'hop' && this.state === 'aggro') {
      if (this.hopTimer >= 0.2 && this.hopTimer < 0.55) {
        return this.sprites.hop;
      }
      if (this.hopTimer < 0.2 || (this.hopTimer >= 0.55 && this.hopTimer < 0.72)) {
        return this.sprites.squash;
      }
    }

    // Animation respirante / frémissante de base
    const frameIndex = Math.floor(this.animTimer * 2.5) % 2;
    return frameIndex === 0 ? this.sprites.idle0 : this.sprites.idle1;
  }

  public getHealthBarInfo(): {
    percent: number;
    health: number;
    maxHealth: number;
    rank: 'normal' | 'elite' | 'boss';
    name: string;
    isVisible: boolean;
  } {
    const isVisible =
      this.active &&
      this.health > 0 &&
      (this.health < this.maxHealth ||
        this.state === 'aggro' ||
        this.type.rank !== 'normal');

    return {
      percent: Math.max(0, Math.min(1, this.health / this.maxHealth)),
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      rank: this.type.rank,
      name: this.type.name,
      isVisible,
    };
  }

  public isAlive(): boolean {
    return this.active && this.state !== 'dead' && this.health > 0;
  }

  public takeDamage(amount: number, hitAngle?: number): boolean {
    if (!this.active || this.state === 'dead') {
      return false;
    }

    const effective = Math.max(1, amount - this.type.stats.defense);
    this.health = Math.max(0, this.health - effective);

    // L'ennemi s'aggro immédiatement quand on l'attaque
    this.state = 'hurt';
    this.stateTimer = 0.18;

    // Léger recul suite à l'impact
    if (hitAngle !== undefined) {
      this.x += Math.cos(hitAngle) * 0.14;
      this.y += Math.sin(hitAngle) * 0.14;
    }

    if (this.health <= 0) {
      this.die();
    }

    return true;
  }

  private lastMap?: GameMap;

  private die(): void {
    this.state = 'dead';
    this.stateTimer = 0.42;
    this.currentElevation = 0;

    // Seuls les monstres lâchent de l'argent et ne peuvent plus lâcher d'objets
    if (this.onSpawnEntity) {
      const dropInfo = this.getCoinDropInfo();
      for (let i = 0; i < dropInfo.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.18 + Math.random() * 0.32;
        let targetX = this.x + Math.cos(angle) * dist;
        let targetY = this.y + Math.sin(angle) * dist;

        if (this.lastMap && !this.lastMap.isWalkable(targetX, targetY)) {
          targetX = this.x;
          targetY = this.y;
        }

        const coin = new DroppedCoin(
          this.x,
          this.y,
          targetX,
          targetY,
          dropInfo.valuePerCoin,
          this.player,
          (gained) => {
            WalletManager.addCoins(gained);
          }
        );
        this.onSpawnEntity(coin);
      }
    }
  }

  private getCoinDropInfo(): { count: number; valuePerCoin: number } {
    const range = this.type.coinDrop ?? {
      min: this.type.rank === 'boss' ? 18 : this.type.rank === 'elite' ? 5 : 2,
      max: this.type.rank === 'boss' ? 26 : this.type.rank === 'elite' ? 8 : 3,
    };
    const totalCoins =
      range.min + Math.floor(Math.random() * (range.max - range.min + 1));

    if (totalCoins > 10) {
      const count = Math.min(8, Math.max(5, Math.floor(totalCoins / 3)));
      const valuePerCoin = Math.max(1, Math.round(totalCoins / count));
      return { count, valuePerCoin };
    }

    return { count: Math.max(1, totalCoins), valuePerCoin: 1 };
  }

  public override update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    this.lastMap = map;
    this.animTimer += deltaTime;

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - deltaTime);
    }

    // Gestion de l'état mort (animation de flaque bouillonnante puis disparition)
    if (this.state === 'dead') {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.active = false;
      }
      return;
    }

    // Gestion de l'état étourdi / touché
    if (this.state === 'hurt') {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.state = 'aggro';
      }
      return;
    }

    // Gestion de l'état d'attaque
    if (this.state === 'attacking') {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        // Exécution du coup
        this.executeAttack();
        this.state = 'aggro';
      }
      return;
    }

    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const distanceToPlayer = Math.hypot(dx, dy);

    // 1. Détection de la zone d'aggression
    if (this.state === 'idle') {
      if (distanceToPlayer <= this.type.stats.aggroRadius) {
        if (distanceToPlayer <= 2.2 || this.hasLineOfSight(map)) {
          this.state = 'aggro';
          this.hopTimer = 0;
        }
      }
    }

    // 2. Comportement en mode Aggro (poursuite du joueur)
    if (this.state === 'aggro') {
      // Déclenchement de l'attaque si à portée
      if (
        distanceToPlayer <= this.type.stats.attackRange &&
        this.attackCooldownTimer <= 0
      ) {
        this.state = 'attacking';
        this.stateTimer = this.type.stats.attackWindup ?? 0.2;
        return;
      }

      // Mouvement vers le joueur selon le pattern
      const angleToPlayer = Math.atan2(dy, dx);
      this.updateMovement(deltaTime, map, angleToPlayer, distanceToPlayer);
    }
  }

  private updateMovement(
    deltaTime: number,
    map: GameMap,
    angleToPlayer: number,
    distanceToPlayer: number
  ): void {
    if (this.type.movementPattern === 'hop') {
      // Cycle complet du bond de Blob :
      // 0.0 - 0.20s : Compression / Écrasement préparatoire au sol
      // 0.20 - 0.55s : Saut parabolique en avant avec élévation 3D
      // 0.55 - 0.72s : Atterrissage en flaque avec écrasement
      // 0.72 - 0.88s : Repos avant le prochain saut
      this.hopTimer += deltaTime;
      if (this.hopTimer >= 0.88) {
        this.hopTimer = 0;
      }

      if (this.hopTimer >= 0.2 && this.hopTimer < 0.55) {
        const leapProgress = (this.hopTimer - 0.2) / 0.35;
        this.currentElevation = 4 * 0.24 * leapProgress * (1 - leapProgress);

        // Vitesse accrue pendant la phase aérienne du bond
        if (distanceToPlayer > this.type.stats.attackRange * 0.8) {
          const leapSpeed = this.type.stats.moveSpeed * 2.3;
          const moveX = Math.cos(angleToPlayer) * leapSpeed * deltaTime;
          const moveY = Math.sin(angleToPlayer) * leapSpeed * deltaTime;
          this.moveWithCollision(moveX, moveY, map);
        }
      } else {
        this.currentElevation = 0;
      }
    } else {
      // Pattern continu (chase classique)
      this.currentElevation = 0;
      if (distanceToPlayer > this.type.stats.attackRange * 0.8) {
        const speed = this.type.stats.moveSpeed;
        const moveX = Math.cos(angleToPlayer) * speed * deltaTime;
        const moveY = Math.sin(angleToPlayer) * speed * deltaTime;
        this.moveWithCollision(moveX, moveY, map);
      }
    }
  }

  private moveWithCollision(moveX: number, moveY: number, map: GameMap): void {
    const margin = this.hitBox;
    const checkX = moveX > 0 ? this.x + moveX + margin : this.x + moveX - margin;
    const checkY = moveY > 0 ? this.y + moveY + margin : this.y + moveY - margin;

    if (map.isWalkable(checkX, this.y)) {
      this.x += moveX;
    }
    if (map.isWalkable(this.x, checkY)) {
      this.y += moveY;
    }
  }

  private executeAttack(): void {
    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Vérifie que le joueur est toujours à portée d'attaque
    if (dist <= this.type.stats.attackRange * 1.35) {
      this.player.takeDamage(this.type.stats.damage);
      // Rebond en arrière après l'attaque
      const angle = Math.atan2(dy, dx);
      this.x -= Math.cos(angle) * 0.12;
      this.y -= Math.sin(angle) * 0.12;
    }

    this.attackCooldownTimer = this.type.stats.attackCooldown;
  }

  private hasLineOfSight(map: GameMap): boolean {
    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.3) {
      return true;
    }

    const steps = Math.ceil(dist / 0.25);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i < steps; i++) {
      if (map.isWall(this.x + stepX * i, this.y + stepY * i)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Génère les sprites pixel-art du Blob dans les différents états
   */
  private static generateEnemySprites(
    type: EnemyTypeDefinition
  ): Record<string, HTMLCanvasElement> {
    const sprites: Record<string, HTMLCanvasElement> = {};
    const size = 32;

    sprites.idle0 = Enemy.createBlobCanvas(size, type, 'idle0');
    sprites.idle1 = Enemy.createBlobCanvas(size, type, 'idle1');
    sprites.squash = Enemy.createBlobCanvas(size, type, 'squash');
    sprites.hop = Enemy.createBlobCanvas(size, type, 'hop');
    sprites.attacking = Enemy.createBlobCanvas(size, type, 'attacking');
    sprites.hurt = Enemy.createBlobCanvas(size, type, 'hurt');
    sprites.dead = Enemy.createBlobCanvas(size, type, 'dead');

    return sprites;
  }

  private static createBlobCanvas(
    size: number,
    type: EnemyTypeDefinition,
    pose: string
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const theme = type.colorTheme;
    const cx = 16;
    const baseCy = 22;

    let rx = 10;
    let ry = 8;
    let cy = baseCy;

    if (pose === 'idle1') {
      rx = 11;
      ry = 7.5;
      cy = baseCy + 0.5;
    } else if (pose === 'squash' || pose === 'attacking') {
      rx = 13;
      ry = 5.5;
      cy = baseCy + 3;
    } else if (pose === 'hop') {
      rx = 7.5;
      ry = 12;
      cy = baseCy - 3;
    } else if (pose === 'dead') {
      rx = 14;
      ry = 2.5;
      cy = baseCy + 6;
    }

    const isHurt = pose === 'hurt';
    const primaryColor = isHurt ? '#ffffff' : theme.primary;
    const secondaryColor = isHurt ? '#ff8888' : theme.secondary;
    const outlineColor = isHurt ? '#880000' : theme.outline;

    // 1. Aura lumineuse pour les Élites et les Boss
    if (type.rank !== 'normal' && theme.glowColor && pose !== 'dead') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = theme.glowColor;
      ctx.fill();
    }

    // 2. Contour sombre du corps du Blob
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 1.2, ry + 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = outlineColor;
    ctx.fill();

    // 3. Corps gélatineux avec dégradé radial
    const grad = ctx.createRadialGradient(
      cx - 2,
      cy - ry * 0.35,
      1,
      cx,
      cy,
      Math.max(rx, ry)
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, primaryColor);
    grad.addColorStop(0.85, secondaryColor);
    grad.addColorStop(1, outlineColor);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Reflet spéculaire brillant sur le dessus
    if (pose !== 'dead') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(cx - 3, cy - ry + 2, Math.max(2, Math.round(rx * 0.45)), 2);
      ctx.fillRect(cx - 1, cy - ry + 4, 2, 1);
    }

    // 5. Yeux expressifs du Blob
    if (pose !== 'dead') {
      const eyeColor = isHurt ? '#ff0000' : theme.eyeColor;
      const eyeY = cy - (pose === 'hop' ? 3 : 1);
      const eyeSpacing = pose === 'hop' ? 3 : 4;

      // Œil gauche
      ctx.fillStyle = '#0a0812';
      ctx.fillRect(cx - eyeSpacing - 1, eyeY - 1, 3, 3);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(cx - eyeSpacing, eyeY, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - eyeSpacing, eyeY, 1, 1);

      // Œil droit
      ctx.fillStyle = '#0a0812';
      ctx.fillRect(cx + eyeSpacing - 2, eyeY - 1, 3, 3);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(cx + eyeSpacing - 1, eyeY, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + eyeSpacing - 1, eyeY, 1, 1);
    }

    // 6. Couronne de pointes pour le Boss
    if (type.rank === 'boss' && pose !== 'dead') {
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(cx - 4, cy - ry - 2, 2, 3);
      ctx.fillRect(cx - 1, cy - ry - 4, 2, 5);
      ctx.fillRect(cx + 2, cy - ry - 2, 2, 3);
    }

    return canvas;
  }
}
