import { Entity } from './Entity';
import type { GameMap } from '../world/GameMap';
import { PlayerSpriteManager, type PlayerVisualState } from '../graphics/PlayerSpriteManager';
import { SoundManager } from '../core/SoundManager';

/**
 * Représente un joueur distant présent dans l'instance multijoueur.
 * Affiche son avatar 3D animé (Lord Énigmatique / Lord Gourmand),
 * interpole ses mouvements de manière fluide et synchronise ses actions.
 */
export class RemotePlayer extends Entity {
  public readonly id: string;
  public readonly name: string;
  public readonly skinId: string;
  public gearScore: number;

  public hp: number;
  public maxHp: number;

  private targetX: number;
  private targetY: number;
  private targetAngle: number;

  private isMoving = false;
  private isAttacking = false;
  private animTimer = 0;
  private hurtTimer = 0;
  private attackTimer = 0;
  private footstepTimer = 0.30;

  constructor(
    id: string,
    name: string,
    skinId: string,
    gearScore: number,
    x: number,
    y: number,
    angle: number,
    hp = 100,
    maxHp = 100
  ) {
    super(x, y, angle, 0.28);
    this.id = id;
    this.name = name;
    this.skinId = skinId;
    this.gearScore = gearScore;
    this.hp = hp;
    this.maxHp = maxHp;

    this.targetX = x;
    this.targetY = y;
    this.targetAngle = angle;
  }

  public updateNetworkState(
    x: number,
    y: number,
    angle: number,
    isMoving: boolean,
    isAttacking: boolean,
    hp: number,
    maxHp: number
  ): void {
    if (hp <= 0) {
      this.active = false;
      this.hp = 0;
      return;
    }

    this.targetX = x;
    this.targetY = y;
    this.targetAngle = angle;
    this.isMoving = isMoving;

    if (isAttacking) {
      this.isAttacking = true;
      this.attackTimer = 0.35;
    }

    if (hp < this.hp) {
      this.hurtTimer = 0.28;
    }

    this.hp = hp;
    this.maxHp = maxHp;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getScale(): number {
    return 0.52;
  }

  public override getElevation(): number {
    return 0;
  }

  public override update(deltaTime: number, _map: GameMap): void {
    if (!this.active || this.hp <= 0) return;

    this.animTimer += deltaTime;

    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - deltaTime);
    }

    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Bruit de pas 3D spatialisé si le joueur distant marche
    if (this.isMoving) {
      this.footstepTimer += deltaTime;
      if (this.footstepTimer >= 0.40) {
        this.footstepTimer = 0;
        SoundManager.play3D('playerSteps', this.x, this.y, {
          volume: 0.28,
          pitchVariation: 0.12,
          maxDistance: 14,
        });
      }
    } else {
      this.footstepTimer = 0.30;
    }

    // Normalisation des angles dans [-PI, PI] pour éviter toute dérive ou blocage
    while (this.targetAngle < -Math.PI) this.targetAngle += Math.PI * 2;
    while (this.targetAngle > Math.PI) this.targetAngle -= Math.PI * 2;
    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;

    // Téléportation instantanée si décalage trop brutal (> 3.5 blocs)
    const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
    if (distToTarget > 3.5) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.angle = this.targetAngle;
      return;
    }

    // Interpolation fluide (Lerp) de la position
    const factor = Math.min(1, deltaTime * 18);
    this.x += (this.targetX - this.x) * factor;
    this.y += (this.targetY - this.y) * factor;

    // Interpolation fluide de l'orientation angulaire
    let dAngle = this.targetAngle - this.angle;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    this.angle += dAngle * factor;

    while (this.angle < -Math.PI) this.angle += Math.PI * 2;
    while (this.angle > Math.PI) this.angle -= Math.PI * 2;
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!this.active || this.hp <= 0) {
      return null;
    }

    const visualState: PlayerVisualState = this.isAttacking
      ? 'attack'
      : this.isMoving
      ? 'walk'
      : 'idle';

    return PlayerSpriteManager.getSprite(
      this.skinId,
      visualState,
      this.animTimer,
      this.hurtTimer > 0
    );
  }
}
