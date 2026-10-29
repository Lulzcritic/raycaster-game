import { getEnemyType } from '../config/enemyTypes';
import { ItemDatabase } from '../config/ItemDatabase';
import { WalletManager } from '../core/WalletManager';
import { QuestManager } from '../core/QuestManager';
import { GearScoreService } from '../core/GearScoreService';
import { SoundManager } from '../core/SoundManager';
import { GoblinSpriteManager } from '../graphics/GoblinSpriteManager';
import { MimicSpriteManager } from '../graphics/MimicSpriteManager';
import { SkeletonSpriteManager } from '../graphics/SkeletonSpriteManager';
import {
  BloodQueenSpriteManager,
  type BloodQueenAttackKind,
} from '../graphics/BloodQueenSpriteManager';
import {
  CakeKingSpriteManager,
  type CakeKingAttackKind,
} from '../graphics/CakeKingSpriteManager';
import { PumpkinSpriteManager } from '../graphics/PumpkinSpriteManager';
import type { EnemyTypeDefinition } from '../types/enemy';
import type { GameMap } from '../world/GameMap';
import { Arrow } from './Arrow';
import { BloodOrb } from './BloodOrb';
import { BloodWaveSegment } from './BloodWaveSegment';
import { DroppedCoin } from './DroppedCoin';
import { DroppedItemOrb } from './DroppedItemOrb';
import { Entity } from './Entity';
import { FrostingPuddle } from './FrostingPuddle';
import type { Player } from './Player';

export type EnemyState = 'idle' | 'aggro' | 'attacking' | 'hurt' | 'dead';

export class Enemy extends Entity {
  public readonly type: EnemyTypeDefinition;
  public health: number;
  public maxHealth: number;
  public state: EnemyState = 'idle';

  protected readonly player: Player;
  protected readonly onSpawnEntity?: (entity: Entity) => void;
  protected readonly onNotify?: (message: string) => void;
  private readonly sprites: Record<string, HTMLCanvasElement>;

  protected stateTimer = 0;
  private attackCooldownTimer = 0;
  private hopTimer = 0;
  private currentElevation = 0;
  protected animTimer = 0;
  private postAttackTimer = 0;
  private isMoving = false;

  // Variables propres à la Reine de Sang (cycle d'attaques et onde de choc à 360°)
  private bloodQueenAttackKind: BloodQueenAttackKind = 'normal';
  private normalAttacksCount = 0;
  private waveCooldownTimer = 0;

  // Variables propres au Carrot Cake King (glissade, traînée de glaçage & frappe au corps à corps)
  private isCakeKingSliding = false;
  private cakeKingAttackKind: CakeKingAttackKind = 'none';
  private cakeKingSlideCooldown = 2.5;
  private cakeKingSlideAngle = 0;
  private cakeKingFrostingDropTimer = 0;
  private cakeKingSlideDuration = 0;

  // Variables propres au Gobelin au Trésor (fuite, timer de disparition & traînée de pièces)
  private isFleeing = false;
  private fleeTimer = 8.0;
  private coinTrailCooldown = 0.85;

  // Variables propres à la Citrouille (ponte de graines régulières)
  private seedLayTimer = 4.0;
  public canLaySeeds = true;
  private activeSeedsCount = 0;
  public onSeedResolved?: () => void;

  // Variables propres à la Graine de Citrouille (compte à rebours avant éclosion)
  private hatchTimer = 5.5;
  private readonly totalHatchTime = 5.5;
  private hasHatched = false;

  constructor(
    x: number,
    y: number,
    type: EnemyTypeDefinition,
    player: Player,
    onSpawnEntity?: (entity: Entity) => void,
    onNotify?: (message: string) => void
  ) {
    super(x, y, 0, type.hitBox);
    this.type = type;
    this.player = player;
    this.onSpawnEntity = onSpawnEntity;
    this.onNotify = onNotify;
    this.health = type.stats.maxHealth;
    this.maxHealth = type.stats.maxHealth;
    this.sprites =
      type.id === 'mimic' ||
      type.id === 'goblin' ||
      type.id === 'skeleton_archer' ||
      type.id === 'blood_queen' ||
      type.id === 'carrot_cake_king' ||
      type.id === 'pumpkin' ||
      type.id === 'pumpkin_seed'
        ? {}
        : Enemy.generateEnemySprites(type);
  }

  public scaledDamage?: number;
  public get attackDamage(): number {
    return this.scaledDamage ?? this.type.stats.damage;
  }

  public scaleStats(hpMultiplier: number, damageMultiplier: number): void {
    if (this.type.id === 'pumpkin_seed') return;
    this.maxHealth = Math.round(this.type.stats.maxHealth * hpMultiplier);
    this.health = this.maxHealth;
    this.scaledDamage = Math.max(1, Math.round(this.type.stats.damage * damageMultiplier));
  }

  public setAttackCooldown(duration: number): void {
    this.attackCooldownTimer = duration;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getElevation(): number {
    if (this.type.id === 'blood_queen') {
      return this.state === 'dead' ? 0 : 0.08 + Math.sin(this.animTimer * 2.8) * 0.04;
    }
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
    if (this.type.id === 'goblin') {
      return GoblinSpriteManager.getSprite(
        this.state,
        this.animTimer,
        this.stateTimer
      );
    }
    if (this.type.id === 'skeleton_archer') {
      return SkeletonSpriteManager.getSprite(
        this.state,
        this.animTimer,
        this.stateTimer,
        this.type.stats.attackWindup ?? 0.65,
        this.postAttackTimer,
        this.isMoving
      );
    }
    if (this.type.id === 'blood_queen') {
      return BloodQueenSpriteManager.getSprite(
        this.state,
        this.animTimer,
        this.bloodQueenAttackKind,
        this.postAttackTimer
      );
    }
    if (this.type.id === 'carrot_cake_king') {
      return CakeKingSpriteManager.getSprite(
        this.state,
        this.animTimer,
        this.isCakeKingSliding,
        this.cakeKingAttackKind,
        this.postAttackTimer,
        this.isMoving
      );
    }
    if (this.type.id === 'pumpkin') {
      return PumpkinSpriteManager.getPumpkinSprite(
        this.state,
        this.animTimer,
        this.isMoving
      );
    }
    if (this.type.id === 'pumpkin_seed') {
      const progress = 1 - Math.max(0, this.hatchTimer) / this.totalHatchTime;
      return PumpkinSpriteManager.getSeedSprite(
        this.state,
        this.animTimer,
        progress
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
    typeId: string;
    hatchRemaining?: number;
    hatchRatio?: number;
  } {
    const isVisible =
      this.active &&
      this.health > 0 &&
      (this.health < this.maxHealth ||
        this.state === 'aggro' ||
        this.type.rank !== 'normal' ||
        this.type.id === 'pumpkin_seed');

    let name = this.type.name;
    if (this.type.id === 'goblin' && this.isFleeing) {
      name = `${this.type.name} [${Math.max(0, this.fleeTimer).toFixed(1)}s]`;
    }

    const isSeed = this.type.id === 'pumpkin_seed';
    const hatchRemaining = isSeed ? Math.max(0, this.hatchTimer) : undefined;
    const hatchRatio = isSeed
      ? Math.max(0, this.hatchTimer) / this.totalHatchTime
      : undefined;

    return {
      percent: Math.max(0, Math.min(1, this.health / this.maxHealth)),
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      rank: this.type.rank,
      name,
      isVisible,
      typeId: this.type.id,
      hatchRemaining,
      hatchRatio,
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

    if (this.type.movementPattern === 'flee' && !this.isFleeing) {
      this.isFleeing = true;
      this.fleeTimer = 8.0;
      this.coinTrailCooldown = 0.85;
      this.onNotify?.("GOBELIN AU TRÉSOR ! IL S'ENFUIT AVEC SON SAC (8s) !");
    }

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

  protected die(): void {
    this.state = 'dead';
    this.stateTimer = 0.42;
    this.currentElevation = 0;

    // Son de mort 3D spatialisé (SlimeDeath.mp3)
    SoundManager.play3D('slimeDeath', this.x, this.y, { volume: 0.75, pitchVariation: 0.1 });

    QuestManager.onEnemyKilled(this.type.id);

    // Graine de Citrouille écrasée par le joueur avant son éclosion
    if (this.type.id === 'pumpkin_seed') {
      if (this.hasHatched) return;
      this.stateTimer = 0.35;
      this.onSeedResolved?.();
      if (this.onSpawnEntity) {
        const coin = new DroppedCoin(
          this.x,
          this.y,
          this.x + (Math.random() - 0.5) * 0.2,
          this.y + (Math.random() - 0.5) * 0.2,
          1,
          this.player,
          (gained) => {
            WalletManager.addCoins(gained);
          }
        );
        this.onSpawnEntity(coin);
      }
      this.onNotify?.("GRAINE DE CITROUILLE ÉCRASÉE AVANT ÉCLOSION !");
      return;
    }

    // Gobelin au trésor : éruption de pièces ET loot au moins RARE garanti
    if (this.type.id === 'goblin') {
      if (this.onSpawnEntity) {
        // 1. Éruption de 12 à 16 pièces d'or
        const dropCount = 14;
        for (let i = 0; i < dropCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 0.18 + Math.random() * 0.4;
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
            1,
            this.player,
            (gained) => {
              WalletManager.addCoins(gained);
            }
          );
          this.onSpawnEntity(coin);
        }

        // 2. Butin au moins RARE garanti (rare, epic, legendary, artifact)
        // La rareté est pondérée dynamiquement selon le Gear Score du joueur
        const prizeRarity = GearScoreService.rollGuaranteedRareRarity(
          this.player.getGearScore()
        );
        const rawPrize = ItemDatabase.getRandomItemByRarity(prizeRarity);
        if (rawPrize) {
          const prize = GearScoreService.rollItem(
            rawPrize,
            this.player.getGearScore()
          );
          const dropOrb = new DroppedItemOrb(
            this.x,
            this.y,
            this.x + (Math.random() - 0.5) * 0.35,
            this.y + (Math.random() - 0.5) * 0.35,
            prize,
            this.onSpawnEntity
          );
          this.onSpawnEntity(dropOrb);
        }
      }
      this.onNotify?.('GOBELIN AU TRÉSOR ÉLIMINÉ ! UN BUTIN RARE APPARAÎT !');
      return;
    }

    // Monstres standards : pièces d'or uniquement
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

    if (this.postAttackTimer > 0) {
      this.postAttackTimer = Math.max(0, this.postAttackTimer - deltaTime);
      if (this.postAttackTimer <= 0 && this.type.id === 'blood_queen') {
        this.bloodQueenAttackKind = 'normal';
      }
    }

    if (this.waveCooldownTimer > 0) {
      this.waveCooldownTimer = Math.max(0, this.waveCooldownTimer - deltaTime);
    }

    if (this.cakeKingSlideCooldown > 0) {
      this.cakeKingSlideCooldown = Math.max(0, this.cakeKingSlideCooldown - deltaTime);
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - deltaTime);
    }

    // Gestion de l'état mort (animation de flaque bouillonnante puis disparition)
    if (this.state === 'dead') {
      this.isMoving = false;
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.active = false;
      }
      return;
    }

    // Gestion de l'état étourdi / touché
    if (this.state === 'hurt') {
      this.isMoving = false;
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.state = this.type.id === 'pumpkin_seed' ? 'idle' : 'aggro';
      }
      return;
    }

    // Gestion propre à la Graine de Citrouille (immobile, compte à rebours vers éclosion)
    if (this.type.id === 'pumpkin_seed') {
      this.isMoving = false;
      this.hatchTimer -= deltaTime;
      if (this.hatchTimer <= 0 && !this.hasHatched && this.isAlive()) {
        this.hasHatched = true;
        this.active = false;
        this.onSeedResolved?.();
        if (this.onSpawnEntity) {
          const babyPumpkin = new Enemy(
            this.x,
            this.y,
            getEnemyType('pumpkin'),
            this.player,
            this.onSpawnEntity,
            this.onNotify
          );
          babyPumpkin.canLaySeeds = false; // Ne pond pas de graines à l'infini
          babyPumpkin.state = 'idle';
          this.onSpawnEntity(babyPumpkin);
        }
        this.onNotify?.("UNE GRAINE A ÉCLOS ! UNE NOUVELLE CITROUILLE APPARAÎT !");
      }
      return;
    }

    // Gestion de l'état d'attaque
    if (this.state === 'attacking') {
      this.isMoving = false;
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

    // 1. Détection de la zone d'aggression (vue directe requise, pas à travers les murs/portes fermées)
    if (this.state === 'idle') {
      if (distanceToPlayer <= this.type.stats.aggroRadius) {
        if (this.hasLineOfSight(map)) {
          this.state = 'aggro';
          this.hopTimer = 0;
          if (this.type.id === 'pumpkin') {
            this.seedLayTimer = 3.5; // Première graine pondue après 3.5 secondes de combat rapproché
            this.onNotify?.("ATTENTION : UNE CITROUILLE ENSORCELÉE VOUS TRAQUE !");
          }
          if (this.type.id === 'carrot_cake_king') {
            this.cakeKingSlideCooldown = 2.0;
            this.onNotify?.("ATTENTION : LE ROI GÂTEAU À LA CAROTTE S'ÉVEILLE !");
          }
          if (this.type.movementPattern === 'flee' && !this.isFleeing) {
            this.isFleeing = true;
            this.fleeTimer = 8.0;
            this.coinTrailCooldown = 0.85;
            this.onNotify?.("ATTENTION : GOBELIN AU TRÉSOR REPÉRÉ ! (8s POUR L'ÉLIMINER)");
          }
        }
      }
    } else if (this.state === 'aggro' && this.type.rank !== 'boss') {
      // Désaggro si le joueur s'est enfui très loin et hors de vue
      if (
        distanceToPlayer > Math.max(10.0, this.type.stats.aggroRadius * 1.5) &&
        !this.hasLineOfSight(map)
      ) {
        this.state = 'idle';
        this.isMoving = false;
        if (this.type.id === 'pumpkin') {
          this.seedLayTimer = 4.0;
        }
      }
    }

    // 2. Comportement en mode Aggro (poursuite du joueur OU fuite)
    if (this.state === 'aggro') {
      if (this.type.movementPattern === 'flee') {
        // Décompte des 8 secondes avant fuite définitive
        this.fleeTimer -= deltaTime;
        if (this.fleeTimer <= 0) {
          this.active = false;
          this.onNotify?.("LE GOBELIN AU TRÉSOR S'EST ÉCHAPPÉ DANS LES OMBRES !");
          return;
        }

        // Lâche des pièces derrière lui dans sa course
        this.coinTrailCooldown -= deltaTime;
        if (this.coinTrailCooldown <= 0 && this.onSpawnEntity) {
          this.coinTrailCooldown = 0.85;
          const angleToPlayer = Math.atan2(dy, dx);
          let dropX = this.x + Math.cos(angleToPlayer) * 0.28;
          let dropY = this.y + Math.sin(angleToPlayer) * 0.28;
          if (map && !map.isWalkable(dropX, dropY)) {
            dropX = this.x;
            dropY = this.y;
          }
          const coin = new DroppedCoin(
            this.x,
            this.y,
            dropX,
            dropY,
            1,
            this.player,
            (gained) => {
              WalletManager.addCoins(gained);
            }
          );
          this.onSpawnEntity(coin);
        }

        // Fuite à l'opposé du joueur avec navigation
        this.updateFleeMovement(deltaTime, map, dx, dy);
        return;
      }

      // Ponte de graines par la Citrouille enragée : UNIQUEMENT si le joueur est proche (<= 4.5) et en vue
      if (this.type.id === 'pumpkin' && this.canLaySeeds) {
        const isPlayerNearby = distanceToPlayer <= 4.5 && this.hasLineOfSight(map);
        if (isPlayerNearby && this.activeSeedsCount < 2) {
          this.seedLayTimer -= deltaTime;
          if (this.seedLayTimer <= 0 && this.onSpawnEntity) {
            this.seedLayTimer = 8.5;
            this.activeSeedsCount++;
            const seed = new Enemy(
              this.x,
              this.y,
              getEnemyType('pumpkin_seed'),
              this.player,
              this.onSpawnEntity,
              this.onNotify
            );
            seed.onSeedResolved = () => {
              this.activeSeedsCount = Math.max(0, this.activeSeedsCount - 1);
            };
            this.onSpawnEntity(seed);
            this.onNotify?.("LA CITROUILLE A PONDU UNE GRAINE ! DÉTRUISEZ-LA VITE !");
          }
        }
      }

      // Gestion spécifique au Carrot Cake King (Attaque 1 : Glissade avec traînée de glaçage)
      if (this.type.id === 'carrot_cake_king') {
        if (this.isCakeKingSliding) {
          this.isMoving = true;
          this.cakeKingSlideDuration += deltaTime;
          this.cakeKingFrostingDropTimer += deltaTime;

          // Dépôt régulier de flaques de glaçage sous sa course
          if (this.cakeKingFrostingDropTimer >= 0.12 && this.onSpawnEntity) {
            this.cakeKingFrostingDropTimer = 0;
            const puddle = new FrostingPuddle(this.x, this.y, 8.5);
            this.onSpawnEntity(puddle);
          }

          const slideSpeed = 3.6;
          const moveX = Math.cos(this.cakeKingSlideAngle) * slideSpeed * deltaTime;
          const moveY = Math.sin(this.cakeKingSlideAngle) * slideSpeed * deltaTime;
          const prevX = this.x;
          const prevY = this.y;
          this.moveWithCollision(moveX, moveY, map);

          const currentDist = Math.hypot(this.player.x - this.x, this.player.y - this.y);
          const hitObstacle = Math.hypot(this.x - prevX, this.y - prevY) < 0.0005;

          // Fin de la glissade : arrivée au corps à corps du joueur ou choc contre un mur
          if (
            currentDist <= this.type.stats.attackRange * 1.05 ||
            hitObstacle ||
            this.cakeKingSlideDuration >= 2.8
          ) {
            this.isCakeKingSliding = false;
            this.cakeKingSlideCooldown = 5.5;

            // Dès son arrivée au corps à corps, enchaîne directement avec l'Attaque 2 (coup de corps à corps)
            if (currentDist <= this.type.stats.attackRange * 1.4) {
              this.state = 'attacking';
              this.cakeKingAttackKind = 'melee';
              this.stateTimer = this.type.stats.attackWindup ?? 0.22;
              this.isMoving = false;
            }
            return;
          }
          return;
        }

        // Déclenchement de l'Attaque 1 (Glissade) si à distance avec ligne de vue
        if (
          this.cakeKingSlideCooldown <= 0 &&
          distanceToPlayer >= 1.6 &&
          this.hasLineOfSight(map)
        ) {
          this.isCakeKingSliding = true;
          this.cakeKingAttackKind = 'slide';
          this.cakeKingSlideAngle = Math.atan2(dy, dx);
          this.cakeKingSlideDuration = 0;
          this.cakeKingFrostingDropTimer = 0;
          this.onNotify?.("LE ROI GÂTEAU GLISSE À PLEINE VITESSE VERS VOUS !");
          return;
        }

        // Déclenchement de l'Attaque 2 (Coup de corps à corps) si à portée
        if (
          distanceToPlayer <= this.type.stats.attackRange &&
          this.attackCooldownTimer <= 0
        ) {
          this.state = 'attacking';
          this.cakeKingAttackKind = 'melee';
          this.stateTimer = this.type.stats.attackWindup ?? 0.25;
          this.isMoving = false;
          return;
        }
      }

      // Déclenchement de l'attaque si à portée
      if (
        distanceToPlayer <= this.type.stats.attackRange &&
        this.attackCooldownTimer <= 0
      ) {
        if (this.type.id === 'blood_queen') {
          // Cycle de combat de la Reine de Sang (Boss Zone 3) :
          // L'Attaque 2 (Onde de sang) se charge périodiquement après plusieurs orbes
          const shouldCastWave =
            this.normalAttacksCount >= 3 ||
            (this.normalAttacksCount >= 2 && this.waveCooldownTimer <= 0);

          if (shouldCastWave) {
            this.bloodQueenAttackKind = 'wave_charge';
            this.state = 'attacking';
            this.stateTimer = 2.4; // Temps de chargement
            this.isMoving = false;
            this.onNotify?.(
              'LA REINE DE SANG CANALISE UNE ONDE DE SANG ! CACHEZ-VOUS DERRIÈRE UN PILIER !'
            );
            return;
          }

          // Attaque 1 normale : tir d'un orbe de sang individuel
          if (this.hasLineOfSight(map)) {
            this.bloodQueenAttackKind = 'normal';
            this.state = 'attacking';
            this.stateTimer = this.type.stats.attackWindup ?? 0.45;
            this.isMoving = false;
            return;
          }
        } else if (this.type.attackType === 'ranged') {
          // Attaque à distance UNIQUEMENT quand le joueur est dans la ligne de vue
          if (this.hasLineOfSight(map)) {
            this.state = 'attacking';
            this.stateTimer = this.type.stats.attackWindup ?? 0.65;
            this.isMoving = false;
            return;
          }
        } else {
          this.state = 'attacking';
          this.stateTimer = this.type.stats.attackWindup ?? 0.2;
          this.isMoving = false;
          return;
        }
      }

      // Mouvement vers le joueur selon le pattern
      const angleToPlayer = Math.atan2(dy, dx);
      this.updateMovement(deltaTime, map, angleToPlayer, distanceToPlayer);
    }
  }

  private updateFleeMovement(
    deltaTime: number,
    map: GameMap,
    dx: number,
    dy: number
  ): void {
    this.currentElevation = 0;
    const angleToPlayer = Math.atan2(dy, dx);
    const baseAngle = angleToPlayer + Math.PI;

    // Balayage d'angles pour trouver une issue dégagée évitant les murs
    let fleeAngle = baseAngle;
    const offsets = [
      0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, Math.PI,
    ];
    for (const offset of offsets) {
      const candidate = baseAngle + offset;
      const testX = this.x + Math.cos(candidate) * (this.hitBox + 0.35);
      const testY = this.y + Math.sin(candidate) * (this.hitBox + 0.35);
      if (map.isWalkable(testX, testY)) {
        fleeAngle = candidate;
        break;
      }
    }

    const speed = this.type.stats.moveSpeed;
    const moveX = Math.cos(fleeAngle) * speed * deltaTime;
    const moveY = Math.sin(fleeAngle) * speed * deltaTime;
    this.moveWithCollision(moveX, moveY, map);
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
          this.isMoving = true;
        }
      } else {
        this.currentElevation = 0;
        this.isMoving = false;
      }
    } else if (
      this.type.attackType === 'ranged' ||
      this.type.movementPattern === 'kite'
    ) {
      this.currentElevation = 0;
      // Comportement tactique de l'archer à distance :
      // 1. Si le joueur est trop proche (< 2.4 blocs), recule pour maintenir sa distance de tir
      if (distanceToPlayer < 2.4) {
        const retreatAngle = angleToPlayer + Math.PI;
        const speed = this.type.stats.moveSpeed * 1.05;
        let moveAngle = retreatAngle;
        const testOffsets = [0, 0.4, -0.4, 0.8, -0.8];
        for (const offset of testOffsets) {
          const cand = retreatAngle + offset;
          const tx = this.x + Math.cos(cand) * (this.hitBox + 0.25);
          const ty = this.y + Math.sin(cand) * (this.hitBox + 0.25);
          if (map.isWalkable(tx, ty)) {
            moveAngle = cand;
            break;
          }
        }
        const moveX = Math.cos(moveAngle) * speed * deltaTime;
        const moveY = Math.sin(moveAngle) * speed * deltaTime;
        this.moveWithCollision(moveX, moveY, map);
        this.isMoving = true;
      } else if (distanceToPlayer > 6.5 || !this.hasLineOfSight(map)) {
        // 2. Si le joueur est trop loin ou masqué par un mur/pilier, avance vers lui pour obtenir la vue
        const speed = this.type.stats.moveSpeed;
        const moveX = Math.cos(angleToPlayer) * speed * deltaTime;
        const moveY = Math.sin(angleToPlayer) * speed * deltaTime;
        this.moveWithCollision(moveX, moveY, map);
        this.isMoving = true;
      } else {
        // 3. Portée optimale (2.4 à 6.5 blocs) avec ligne de mire : posture fixe pour armer l'arc
        this.isMoving = false;
      }
    } else {
      // Pattern continu (chase classique)
      this.currentElevation = 0;
      if (distanceToPlayer > this.type.stats.attackRange * 0.8) {
        const speed = this.type.stats.moveSpeed;
        const moveX = Math.cos(angleToPlayer) * speed * deltaTime;
        const moveY = Math.sin(angleToPlayer) * speed * deltaTime;
        this.moveWithCollision(moveX, moveY, map);
        this.isMoving = true;
      } else {
        this.isMoving = false;
      }
    }
  }

  private moveWithCollision(moveX: number, moveY: number, map: GameMap): void {
    if (map.canMove(this.x + moveX, this.y, this.hitBox)) {
      this.x += moveX;
    }
    if (map.canMove(this.x, this.y + moveY, this.hitBox)) {
      this.y += moveY;
    }
  }

  private executeAttack(): void {
    if (this.type.id === 'blood_queen') {
      if (this.bloodQueenAttackKind === 'wave_charge') {
        // Déclenchement de l'Attaque 2 : Onde de sang déferlant tout autour d'elle (360°)
        this.bloodQueenAttackKind = 'wave_release';
        const waveId = Date.now();
        if (this.onSpawnEntity) {
          const segmentCount = 32;
          for (let i = 0; i < segmentCount; i++) {
            const angle = (i * 2 * Math.PI) / segmentCount;
            const seg = new BloodWaveSegment(
              this.x + Math.cos(angle) * 0.4,
              this.y + Math.sin(angle) * 0.4,
              angle,
              42,
              waveId
            );
            this.onSpawnEntity(seg);
          }
        }
        this.postAttackTimer = 0.55; // Maintient la pose attack2.png pendant la vague
        this.normalAttacksCount = 0;
        this.waveCooldownTimer = 9.0;
        this.attackCooldownTimer = 2.4;
        this.onNotify?.("L'ONDE DE SANG SE DÉCHAÎNE TOUT AUTOUR D'ELLE !");
        return;
      }

      // Attaque 1 : Tir d'orbe de sang individuel ciblé sur le joueur
      const dx = this.player.x - this.x;
      const dy = this.player.y - this.y;
      const angleToPlayer = Math.atan2(dy, dx);
      if (this.onSpawnEntity) {
        const orb = new BloodOrb(
          this.x + Math.cos(angleToPlayer) * 0.35,
          this.y + Math.sin(angleToPlayer) * 0.35,
          angleToPlayer,
          this.attackDamage
        );
        this.onSpawnEntity(orb);
      }
      this.normalAttacksCount++;
      this.postAttackTimer = 0.24;
      this.attackCooldownTimer = this.type.stats.attackCooldown;
      return;
    }

    if (this.type.id === 'carrot_cake_king') {
      const dx = this.player.x - this.x;
      const dy = this.player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= this.type.stats.attackRange * 1.4) {
        this.player.takeDamage(this.attackDamage);
        this.onNotify?.(`LE ROI GÂTEAU VOUS ASSÈNE UN COUP DE CORPS À CORPS ! (-${this.attackDamage} PV)`);
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * 0.12;
        this.y -= Math.sin(angle) * 0.12;
      }

      this.postAttackTimer = 0.35; // Maintient la pose de frappe attack2.png
      this.attackCooldownTimer = this.type.stats.attackCooldown;
      return;
    }

    if (this.type.attackType === 'ranged') {
      const dx = this.player.x - this.x;
      const dy = this.player.y - this.y;
      const angleToPlayer = Math.atan2(dy, dx);

      if (this.onSpawnEntity) {
        const arrow = new Arrow(
          this.x,
          this.y,
          angleToPlayer,
          this.attackDamage,
          this.player
        );
        this.onSpawnEntity(arrow);
      }

      this.postAttackTimer = 0.24; // Pose de décoche (attack3) maintenue
      this.attackCooldownTimer = this.type.stats.attackCooldown;
      return;
    }

    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Vérifie que le joueur est toujours à portée d'attaque
    if (dist <= this.type.stats.attackRange * 1.35) {
      this.player.takeDamage(this.attackDamage);
      // Rebond en arrière après l'attaque
      const angle = Math.atan2(dy, dx);
      this.x -= Math.cos(angle) * 0.12;
      this.y -= Math.sin(angle) * 0.12;
    }

    this.postAttackTimer = 0.22;
    this.attackCooldownTimer = this.type.stats.attackCooldown;
  }

  private hasLineOfSight(map: GameMap): boolean {
    return map.hasLineOfSight(this.x, this.y, this.player.x, this.player.y);
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
