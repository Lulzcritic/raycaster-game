import { I18nService } from '../core/I18nService';
import { SoundManager } from '../core/SoundManager';
import { CatSpriteManager, type CatVisualState } from '../graphics/CatSpriteManager';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import type { Player } from './Player';

/**
 * Entité Chat Compagnon paisible de la Citadelle :
 * - Déambule librement et doucement dans les pièces et couloirs
 * - S'arrête curieusement par moments pour observer les alentours
 * - Peut être caressé avec la touche [F] pour restaurer 35% des PV maximum du joueur
 * - S'arrête et ronronne lors des caresses, puis s'endort pour un cycle de récupération d'une minute (60s)
 * - Se réveille rechargé et prêt à offrir à nouveau son affection
 * - Totalement invulnérable et pacifique (insensible aux tirs, sorts et attaques des monstres)
 */
export class Cat extends Entity {
  public state: CatVisualState = 'wandering';
  public sleepTimer = 0;
  public purrTimer = 0;
  public idleTimer = 0;
  public wanderAngle: number;
  public wanderChangeTimer: number;
  public animTimer = 0;
  public readonly scale: number;

  public static readonly SLEEP_DURATION = 60.0; // 1 minute de sommeil
  public static readonly PURR_DURATION = 3.5;  // 3.5s de ronronnement
  public static readonly HEAL_PERCENT = 0.35;  // 35% des PV max

  constructor(x: number, y: number, scale = 0.42) {
    super(x, y, 0, 0.28);
    this.scale = scale;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderChangeTimer = 2.0 + Math.random() * 3.0;
  }

  public update(deltaTime: number, map: GameMap): void {
    this.animTimer += deltaTime;

    // 1. État : Ronronnement (après avoir été caressé)
    if (this.state === 'purring') {
      this.purrTimer -= deltaTime;
      if (this.purrTimer <= 0) {
        this.state = 'sleeping';
        this.sleepTimer = Cat.SLEEP_DURATION;
        this.animTimer = 0;
      }
      return;
    }

    // 2. État : Sommeil (dure 1 minute, recharge en cours)
    if (this.state === 'sleeping') {
      this.sleepTimer -= deltaTime;
      if (this.sleepTimer <= 0) {
        // Réveil rechargé
        this.state = 'wandering';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderChangeTimer = 2.0 + Math.random() * 3.0;
        this.animTimer = 0;
        SoundManager.play3D('catMeow', this.x, this.y, { volume: 0.65 });
      }
      return;
    }

    // 3. État : Pause curieuse assise (idle)
    if (this.state === 'idle') {
      this.idleTimer -= deltaTime;
      if (this.idleTimer <= 0) {
        this.state = 'wandering';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderChangeTimer = 2.5 + Math.random() * 3.0;
      }
      return;
    }

    // 4. État : Déambulation douce (wandering)
    this.wanderChangeTimer -= deltaTime;
    if (this.wanderChangeTimer <= 0) {
      this.wanderChangeTimer = 2.5 + Math.random() * 3.5;
      // 25% de chance de faire une petite pause assise contemplative
      if (Math.random() < 0.25) {
        this.state = 'idle';
        this.idleTimer = 2.0 + Math.random() * 2.5;
        return;
      }
      // Changement progressif d'orientation
      this.wanderAngle += (Math.random() - 0.5) * (Math.PI * 0.8);
    }

    const moveSpeed = 0.65; // Déplacement doux
    const step = moveSpeed * deltaTime;
    const nx = this.x + Math.cos(this.wanderAngle) * step;
    const ny = this.y + Math.sin(this.wanderAngle) * step;

    // Détection d'obstacles et glissement le long des parois
    const canMoveX = map.isWalkable(nx, this.y, this.hitBox);
    const canMoveY = map.isWalkable(this.x, ny, this.hitBox);

    if (canMoveX && canMoveY && map.isWalkable(nx, ny, this.hitBox)) {
      this.x = nx;
      this.y = ny;
    } else if (canMoveX) {
      this.x = nx;
      this.wanderAngle = -this.wanderAngle;
    } else if (canMoveY) {
      this.y = ny;
      this.wanderAngle = Math.PI - this.wanderAngle;
    } else {
      // Rebond dans une direction opposée si coincé
      this.wanderAngle += Math.PI * 0.5 + (Math.random() - 0.5) * 0.6;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    return CatSpriteManager.getSprite(this.state, this.animTimer);
  }

  public override getScale(): number {
    return this.scale;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override isInteractable(): boolean {
    return this.active && this.state !== 'purring';
  }

  public override getInteractionPrompt(_player?: Player): string | null {
    if (!this.isInteractable()) {
      return null;
    }

    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (this.state === 'sleeping') {
      const remainingSec = Math.max(1, Math.ceil(this.sleepTimer));
      return isFr
        ? `[Zzz... Le chat dort paisiblement (${remainingSec}s)]`
        : `[Zzz... The cat is sleeping peacefully (${remainingSec}s)]`;
    }

    return isFr
      ? '[F] CARESSER LE CHAT (+35% PV)'
      : '[F] PET THE CAT (+35% HP)';
  }

  public override interact(player: Player, _map?: GameMap): string | null {
    if (!this.isInteractable()) {
      return null;
    }

    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (this.state === 'sleeping') {
      SoundManager.play3D('catPurr', this.x, this.y, { volume: 0.40 });
      return isFr
        ? '🐱 Zzz... Le chat dort profondément et récupère son énergie.'
        : '🐱 Zzz... The cat is resting deeply and restoring its energy.';
    }

    // Le joueur caresse le chat
    const healAmount = Math.round(player.maxHealth * Cat.HEAL_PERCENT);
    const actualHealed = player.heal(healAmount);

    SoundManager.play3D('catPurr', this.x, this.y, { volume: 0.85 });
    SoundManager.play3D('catMeow', this.x, this.y, { volume: 0.75 });

    this.state = 'purring';
    this.purrTimer = Cat.PURR_DURATION;
    this.animTimer = 0;

    if (actualHealed > 0) {
      return isFr
        ? `🐱 Ronronnements apaisants... Vous récupérez +${actualHealed} PV !`
        : `🐱 Soothing purrs... Restored +${actualHealed} HP!`;
    }

    return isFr
      ? '🐱 Le chat ronronne affectueusement contre vous. Vos PV sont déjà au maximum !'
      : '🐱 The cat purrs affectionately against you. Your HP is already at maximum!';
  }

  /**
   * Le chat est totalement invulnérable aux attaques des joueurs et des monstres.
   */
  public takeDamage(_amount: number): void {
    // Aucune prise de dégâts, invulnérabilité complète
  }
}
