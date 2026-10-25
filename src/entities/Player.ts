import { DEFAULT_PLAYER_CONFIG, FIREBALL_CONFIG, PURPLE_ORB_CONFIG, KEYS } from '../config/constants';
import type { InputManager } from '../core/InputManager';
import type { EquipmentItem, ItemStats, PlayerConfig } from '../types';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import { Fireball } from './Fireball';
import { PurpleOrb } from './PurpleOrb';
import { Inventory } from './Inventory';
import { UpgradeManager } from '../core/UpgradeManager';

export class Player extends Entity {
  public readonly inventory = new Inventory();
  public readonly width: number;
  public readonly height: number;
  public fov: number;
  public speedRotation: number;
  public speedMove: number;
  public speedStrafe: number;
  public mouseSensitivity: number;
  public bobFrequency: number;
  public bobAmplitude: number;

  // Décalage X/Y de la main au premier plan lors de la marche
  public handBobX = 0;
  public handBobY = 0;

  // Caractéristiques vitales du joueur
  public health = 100;
  public maxHealth = 100;
  public damageFlashTimer = 0;

  private readonly input: InputManager;
  private readonly onShoot?: (projectile: Entity) => void;
  private shootCooldown = 0;
  private secondaryCooldown = 0;
  private maxSecondaryCooldown: number = PURPLE_ORB_CONFIG.COOLDOWN;
  private bobTimer = 0;

  // Effet de ralentissement (glaçage collant du Carrot Cake King)
  private frostingSlowTimer = 0;
  private frostingSlowFactor = 1.0;

  constructor(
    input: InputManager,
    config: Partial<PlayerConfig> = {},
    onShoot?: (projectile: Entity) => void
  ) {
    const fullConfig: PlayerConfig = { ...DEFAULT_PLAYER_CONFIG, ...config };
    super(fullConfig.x, fullConfig.y, fullConfig.angle, fullConfig.hitBox);

    this.input = input;
    this.onShoot = onShoot;
    this.width = fullConfig.width;
    this.height = fullConfig.height;
    this.fov = fullConfig.fov;
    this.speedRotation = fullConfig.speedRotation;
    this.speedMove = fullConfig.speedMove;
    this.speedStrafe = fullConfig.speedStrafe;
    this.mouseSensitivity = fullConfig.mouseSensitivity;
    this.bobFrequency = fullConfig.bobFrequency;
    this.bobAmplitude = fullConfig.bobAmplitude;

    this.maxHealth = 100 + this.getEffectiveStats().maxHealth;
    this.health = this.maxHealth;
  }

  /**
   * Ramasse un objet et le place automatiquement dans le slot d'inventaire correspondant à sa catégorie
   */
  public pickupItem(item: EquipmentItem): EquipmentItem | null {
    const prev = this.inventory.equip(item);
    this.maxHealth = 100 + this.getEffectiveStats().maxHealth;
    this.health = Math.min(this.health, this.maxHealth);
    return prev;
  }

  public hasKey(keyId?: string): boolean {
    return this.inventory.hasKey(keyId);
  }

  public useKey(keyId?: string): boolean {
    return this.inventory.useKey(keyId);
  }

  public getEffectiveStats(): Required<ItemStats> {
    const gear = this.inventory.getTotalStats();
    const upg = UpgradeManager.getStats();
    return {
      damage: gear.damage + upg.damage,
      defense: gear.defense + upg.defense,
      magicPower: gear.magicPower + upg.magicPower,
      maxHealth: gear.maxHealth + upg.maxHealth,
      moveSpeed: gear.moveSpeed + upg.moveSpeed,
      castSpeed: gear.castSpeed + upg.castSpeed,
      stealth: gear.stealth + upg.stealth,
      charisma: gear.charisma + upg.charisma,
    };
  }

  public takeDamage(amount: number): void {
    const defense = this.getEffectiveStats().defense;
    const effective = Math.max(1, amount - defense);
    this.health = Math.max(0, this.health - effective);
    this.damageFlashTimer = 0.28;
  }

  public isAlive(): boolean {
    return this.health > 0;
  }

  public isCasting(): boolean {
    return (
      this.shootCooldown > FIREBALL_CONFIG.COOLDOWN * 0.35 ||
      this.secondaryCooldown > this.maxSecondaryCooldown - 0.25
    );
  }

  public getSecondaryCooldown(): number {
    return this.secondaryCooldown;
  }

  public getMaxSecondaryCooldown(): number {
    return this.maxSecondaryCooldown;
  }

  public applyFrostingSlow(duration = 0.35, factor = 0.45): void {
    this.frostingSlowTimer = Math.max(this.frostingSlowTimer, duration);
    this.frostingSlowFactor = factor;
  }

  public isSlowed(): boolean {
    return this.frostingSlowTimer > 0;
  }

  public update(deltaTime: number, map: GameMap): void {
    const bonusStats = this.getEffectiveStats();
    this.maxHealth = 100 + bonusStats.maxHealth;
    this.health = Math.min(this.health, this.maxHealth);

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaTime);
    }

    if (this.frostingSlowTimer > 0) {
      this.frostingSlowTimer = Math.max(0, this.frostingSlowTimer - deltaTime);
    }

    // Gestion du temps de recharge du tir principal (Boule de feu)
    if (this.shootCooldown > 0) {
      this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime);
    }

    // Gestion du temps de recharge du sort secondaire (Orbe violette)
    if (this.secondaryCooldown > 0) {
      this.secondaryCooldown = Math.max(0, this.secondaryCooldown - deltaTime);
    }

    // Rotation de la vision à la souris (gauche / droite)
    const mouseDeltaX = this.input.consumeMouseDeltaX();
    if (mouseDeltaX !== 0) {
      this.angle += mouseDeltaX * this.mouseSensitivity;
    }

    // Rotation au clavier (flèches gauche / droite en complément)
    if (this.input.isKeyDown(KEYS.TURN_LEFT)) {
      this.angle -= this.speedRotation * deltaTime;
    }
    if (this.input.isKeyDown(KEYS.TURN_RIGHT)) {
      this.angle += this.speedRotation * deltaTime;
    }

    // Tir de boule de feu (Clic gauche ou Espace)
    const wantsToShoot =
      this.input.isMouseLeftDown() || this.input.isKeyDown(KEYS.SHOOT);
    if (wantsToShoot && this.shootCooldown <= 0) {
      this.shootFireball(
        bonusStats.castSpeed,
        bonusStats.damage,
        bonusStats.magicPower
      );
    }

    // Tir d'orbe violette rebondissante (Clic droit)
    const wantsToShootSecondary =
      this.input.consumeMouseRightClick() || this.input.isMouseRightDown();
    if (wantsToShootSecondary && this.secondaryCooldown <= 0) {
      this.shootPurpleOrb(
        bonusStats.castSpeed,
        bonusStats.damage,
        bonusStats.magicPower
      );
    }

    // Calcul des intentions de déplacement (Avant/Arrière et Gauche/Droite)
    let forwardInput = 0;
    if (this.input.isKeyDown(KEYS.MOVE_FORWARD)) forwardInput += 1;
    if (this.input.isKeyDown(KEYS.MOVE_BACKWARD)) forwardInput -= 1;

    let strafeInput = 0;
    if (this.input.isKeyDown(KEYS.STRAFE_RIGHT)) strafeInput += 1;
    if (this.input.isKeyDown(KEYS.STRAFE_LEFT)) strafeInput -= 1;

    const prevX = this.x;
    const prevY = this.y;

    if (forwardInput !== 0 || strafeInput !== 0) {
      const slowMultiplier = this.frostingSlowTimer > 0 ? this.frostingSlowFactor : 1.0;
      const speedBonus = (1 + bonusStats.moveSpeed) * slowMultiplier;
      // Normalisation du vecteur pour éviter d'aller 1.41x plus vite en diagonale
      const length = Math.hypot(forwardInput, strafeInput);
      const forwardSpeed = (forwardInput / length) * this.speedMove * speedBonus;
      const strafeSpeed = (strafeInput / length) * this.speedStrafe * speedBonus;

      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);

      // Vecteur avant : (cos, sin) | Vecteur latéral droit (+PI/2) : (-sin, cos)
      const moveX = (cos * forwardSpeed - sin * strafeSpeed) * deltaTime;
      const moveY = (sin * forwardSpeed + cos * strafeSpeed) * deltaTime;

      this.applyMovement(moveX, moveY, map);
    }

    // Balancement de la main au premier plan (courbe en U façon Doom) quand le joueur marche
    const hasMoved = Math.hypot(this.x - prevX, this.y - prevY) > 0.0001;
    if (hasMoved) {
      this.bobTimer += deltaTime * this.bobFrequency;
      this.handBobX = Math.sin(this.bobTimer * 0.5) * (this.bobAmplitude * 1.8);
      this.handBobY = Math.abs(Math.cos(this.bobTimer * 0.5)) * this.bobAmplitude;
    } else {
      // Retour fluide de la main à sa position de repos
      const decay = Math.max(0, 1 - deltaTime * 10);
      this.handBobX *= decay;
      this.handBobY *= decay;
      if (Math.hypot(this.handBobX, this.handBobY) < 0.05) {
        this.handBobX = 0;
        this.handBobY = 0;
        this.bobTimer = 0;
      }
    }
  }

  private shootFireball(
    castSpeedBonus = 0,
    bonusDamage = 0,
    magicPower = 0
  ): void {
    const cooldownFactor = Math.max(0.4, 1 - castSpeedBonus);
    this.shootCooldown = FIREBALL_CONFIG.COOLDOWN * cooldownFactor;
    const spawnX = this.x + Math.cos(this.angle) * FIREBALL_CONFIG.SPAWN_OFFSET;
    const spawnY = this.y + Math.sin(this.angle) * FIREBALL_CONFIG.SPAWN_OFFSET;
    const totalDamage = 16 + bonusDamage + magicPower;
    const fireball = new Fireball(spawnX, spawnY, this.angle, totalDamage);
    this.onShoot?.(fireball);
  }

  private shootPurpleOrb(
    castSpeedBonus = 0,
    bonusDamage = 0,
    magicPower = 0
  ): void {
    const cooldownFactor = Math.max(0.4, 1 - castSpeedBonus);
    this.secondaryCooldown = PURPLE_ORB_CONFIG.COOLDOWN * cooldownFactor;
    this.maxSecondaryCooldown = this.secondaryCooldown;
    const spawnX = this.x + Math.cos(this.angle) * PURPLE_ORB_CONFIG.SPAWN_OFFSET;
    const spawnY = this.y + Math.sin(this.angle) * PURPLE_ORB_CONFIG.SPAWN_OFFSET;
    const totalDamage = PURPLE_ORB_CONFIG.DAMAGE + bonusDamage + Math.round(magicPower * 1.5);
    const orb = new PurpleOrb(spawnX, spawnY, this.angle, totalDamage);
    this.onShoot?.(orb);
  }

  private applyMovement(moveX: number, moveY: number, map: GameMap): void {
    // Marge de collision (hitbox) selon le sens de marche
    const checkX = moveX > 0 ? this.x + moveX + this.hitBox : this.x + moveX - this.hitBox;
    const checkY = moveY > 0 ? this.y + moveY + this.hitBox : this.y + moveY - this.hitBox;

    // Déplacement en X si libre
    if (map.isWalkable(checkX, this.y)) {
      this.x += moveX;
    }
    // Déplacement en Y si libre
    if (map.isWalkable(this.x, checkY)) {
      this.y += moveY;
    }
  }
}
