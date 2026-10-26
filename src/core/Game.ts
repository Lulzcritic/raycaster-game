import { INTERACTION_CONFIG, KEYS, TEXTURE_DEFINITIONS, TILE_TYPE } from '../config/constants';
import { getEnemyType } from '../config/enemyTypes';
import { ItemDatabase } from '../config/ItemDatabase';
import { BillboardSprite } from '../entities/BillboardSprite';
import { Door } from '../entities/Door';
import { Enemy } from '../entities/Enemy';
import type { Entity } from '../entities/Entity';
import { ExtractionPortal } from '../entities/ExtractionPortal';
import { Fireball } from '../entities/Fireball';
import { Player } from '../entities/Player';
import { Renderer } from '../graphics/Renderer';
import { TextureManager } from '../graphics/TextureManager';
import type { EquipmentItem, LevelData, TextureDefinition } from '../types';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { PauseMenu } from '../ui/PauseMenu';
import { MainMenu } from '../ui/MainMenu';
import { HubUI } from '../ui/HubUI';
import { WorldBillboardOverlay } from '../ui/WorldBillboardOverlay';
import { HUDOverlay } from '../ui/HUDOverlay';
import { PlayerHandOverlay } from '../ui/PlayerHandOverlay';
import { GameMap } from '../world/GameMap';
import { MapGenerator } from '../world/procedural/MapGenerator';
import { DroppedItemOrb } from '../entities/DroppedItemOrb';
import { Merchant } from '../entities/Merchant';
import { MerchantUI } from '../ui/MerchantUI';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import { MimicSpriteManager } from '../graphics/MimicSpriteManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import { GoblinSpriteManager } from '../graphics/GoblinSpriteManager';
import { SkeletonSpriteManager } from '../graphics/SkeletonSpriteManager';
import { BloodQueenSpriteManager } from '../graphics/BloodQueenSpriteManager';
import { PumpkinSpriteManager } from '../graphics/PumpkinSpriteManager';
import { CakeKingSpriteManager } from '../graphics/CakeKingSpriteManager';
import { Arrow } from '../entities/Arrow';
import { BloodOrb } from '../entities/BloodOrb';
import { BloodWaveSegment } from '../entities/BloodWaveSegment';
import { PurpleOrb } from '../entities/PurpleOrb';
import { FrostingPuddle } from '../entities/FrostingPuddle';
import { WalletManager } from './WalletManager';
import { QuestManager } from './QuestManager';
import { UpgradeManager } from './UpgradeManager';
import { StashManager } from './StashManager';
import { InputManager } from './InputManager';

export class Game {
  public readonly textures: TextureManager;
  private readonly input: InputManager;
  private readonly renderer: Renderer;
  private readonly pauseMenu: PauseMenu;
  private readonly mainMenu: MainMenu;
  private readonly hubUI: HubUI;
  private readonly merchantUI: MerchantUI;
  private readonly interactionPrompt: InteractionPrompt;
  private readonly worldBillboardOverlay: WorldBillboardOverlay;
  private readonly hudOverlay: HUDOverlay;
  private readonly playerHandOverlay: PlayerHandOverlay;
  private currentLevel: LevelData;
  private map: GameMap;
  private player: Player;
  private entities: Entity[] = [];
  private isPaused = false;
  private isInMainMenu = true;
  private isInHub = false;
  private lastTime = 0;
  private animationFrameId: number | null = null;
  private raidTimer = 0;
  private isExtracted = false;
  private lostHomonculusOnExtract = false;
  private lastHitWaveId = -1;

  constructor(canvas: HTMLCanvasElement, initialLevel?: LevelData) {
    const startLevel = initialLevel ?? MapGenerator.generate();
    this.currentLevel = startLevel;
    const savedFov = Number(localStorage.getItem('raycaster_fov'));
    const initialFovDeg =
      !Number.isNaN(savedFov) && savedFov >= 60 && savedFov <= 110 ? savedFov : 75;

    this.interactionPrompt = new InteractionPrompt();
    this.worldBillboardOverlay = new WorldBillboardOverlay();
    this.hudOverlay = new HUDOverlay(() => this.returnToHub());
    this.playerHandOverlay = new PlayerHandOverlay();
    this.merchantUI = new MerchantUI();
    this.mainMenu = new MainMenu(
      () => {
        this.openHub();
      },
      (fovDegrees) => {
        this.player.fov = (fovDegrees * Math.PI) / 180;
        this.pauseMenu.setFov(fovDegrees);
        try {
          localStorage.setItem('raycaster_fov', String(fovDegrees));
        } catch {
          // Ignore storage restrictions
        }
      },
      initialFovDeg
    );
    this.pauseMenu = new PauseMenu(
      () => {
        this.input.setPaused(false);
      },
      (fovDegrees) => {
        this.player.fov = (fovDegrees * Math.PI) / 180;
        this.mainMenu.setFov(fovDegrees);
        try {
          localStorage.setItem('raycaster_fov', String(fovDegrees));
        } catch {
          // Ignore storage restrictions
        }
      },
      initialFovDeg,
      () => {
        this.returnToMainMenu();
      },
      () => {
        this.returnToHub();
      }
    );

    this.input = new InputManager(canvas, (paused) => {
      if (this.isInMainMenu || this.isInHub) {
        return;
      }
      if (this.merchantUI.isOpen()) {
        if (paused) {
          this.merchantUI.close();
          return;
        }
      }
      this.isPaused = paused;
      this.worldBillboardOverlay.setVisible(!paused);
      this.hudOverlay.setVisible(!paused);
      this.playerHandOverlay.setVisible(!paused);
      if (paused) {
        this.pauseMenu.show();
        this.interactionPrompt.clear();
      } else {
        this.pauseMenu.hide();
      }
    });

    this.input.canTogglePause = () => !this.isInMainMenu && !this.isInHub;
    this.input.onEscapeWhileBlocked = () => {
      if (this.isInMainMenu && this.mainMenu.isInSettings()) {
        this.mainMenu.showMain();
      }
    };

    this.textures = new TextureManager();
    this.renderer = new Renderer(canvas, this.textures);
    this.map = new GameMap(
      startLevel.grid,
      startLevel.floorGrid,
      startLevel.skyTileId
    );
    this.player = new Player(
      this.input,
      {
        x: startLevel.playerSpawn.x,
        y: startLevel.playerSpawn.y,
        angle: startLevel.playerSpawn.angle,
        fov: (initialFovDeg * Math.PI) / 180,
      },
      (projectile) => {
        this.entities.push(projectile);
      }
    );

    this.hubUI = new HubUI(
      () => {
        this.startRaidFromHub();
      },
      () => {
        this.returnToMainMenu();
      }
    );
    this.hubUI.setPlayer(this.player);

    this.spawnLevelSprites(startLevel);

    // Initialisation dans l'état Menu Principal (jeu en pause, HUD masqué)
    this.isPaused = true;
    this.input.setPaused(true, false);
    this.worldBillboardOverlay.setVisible(false);
    this.hudOverlay.setVisible(false);
    this.playerHandOverlay.setVisible(false);
    this.mainMenu.show();
  }

  public getCurrentLevel(): LevelData {
    return this.currentLevel;
  }

  public async init(): Promise<void> {
    WalletManager.init();
    UpgradeManager.init();
    QuestManager.init();
    StashManager.init();
    await Promise.all([
      this.textures.loadAllTextures(),
      ItemSpriteManager.preloadAll(),
      MimicSpriteManager.preloadAll(),
      CoinSpriteManager.preloadAll(),
      GoblinSpriteManager.preloadAll(),
      SkeletonSpriteManager.preloadAll(),
      BloodQueenSpriteManager.preloadAll(),
      PumpkinSpriteManager.preloadAll(),
      CakeKingSpriteManager.preloadAll(),
    ]);
  }

  public loadLevel(level: LevelData): void {
    this.currentLevel = level;
    this.raidTimer = 0;
    this.isExtracted = false;
    this.lostHomonculusOnExtract = false;
    this.map = new GameMap(level.grid, level.floorGrid, level.skyTileId);
    this.player.x = level.playerSpawn.x;
    this.player.y = level.playerSpawn.y;
    this.player.angle = level.playerSpawn.angle;
    this.player.maxHealth = 100 + this.player.getEffectiveStats().maxHealth;
    this.player.health = this.player.maxHealth;
    this.entities = [];
    this.interactionPrompt.clear();
    this.worldBillboardOverlay.clear();
    this.hudOverlay.reset();
    this.playerHandOverlay.setVisible(true);
    this.spawnLevelSprites(level);
  }

  private spawnLevelSprites(level: LevelData): void {
    const spriteDefs = new Map<number, TextureDefinition>(
      TEXTURE_DEFINITIONS.filter((def) => def.category === 'sprite').map((def) => [
        def.id,
        def,
      ])
    );

    const catalogItems = ItemDatabase.getChestLootPool();
    let chestIndex = 0;
    let itemCursor = 0;

    // 1. Détection automatique des IDs de tuiles et sprites placés directement dans la grille du niveau
    for (let row = 0; row < level.grid.length; row++) {
      for (let col = 0; col < level.grid[row].length; col++) {
        const tileId = level.grid[row][col];

        // Spawning de la porte verrouillée avec sa clé correspondante
        if (tileId === TILE_TYPE.DOOR) {
          const doorConfig = level.doors?.find((d) => d.x === col && d.y === row);
          const requiredKey = doorConfig?.requiredKeyId ?? 'key_crypt_skull';
          const door = new Door(col, row, this.textures, requiredKey);
          this.entities.push(door);
          continue;
        }

        const def = spriteDefs.get(tileId);
        if (def) {
          const coordKey = `${col},${row}`;
          const customItemIds = level.chestLoots?.[coordKey];
          let chestLoot: EquipmentItem[] | undefined;

          if (customItemIds && customItemIds.length > 0) {
            chestLoot = customItemIds
              .filter((id) => id !== 'offhand_homonculus')
              .map((id) => ItemDatabase.getItemById(id))
              .filter((item): item is EquipmentItem => item !== undefined);
          } else if (tileId === TILE_TYPE.CHEST && catalogItems.length > 0) {
            const lootCount = chestIndex % 2 === 0 ? 2 : 3;
            chestLoot = Array.from(
              { length: lootCount },
              () => catalogItems[itemCursor++ % catalogItems.length]
            );
          }

          chestIndex++;

          const sprite = new BillboardSprite(
            col + 0.5,
            row + 0.5,
            tileId,
            this.textures,
            def.scale ?? 0.42,
            chestLoot,
            (newEntity) => {
              this.entities.push(newEntity);
            }
          );
          this.entities.push(sprite);
        }
      }
    }

    // 2. Ajout des sprites supplémentaires déclarés par coordonnées libres (optionnel)
    if (level.sprites) {
      for (const s of level.sprites) {
        if (s.textureId === TILE_TYPE.MERCHANT) {
          const merchantItems = this.generateMerchantItems(s.x, s.y);
          const merchant = new Merchant(
            s.x,
            s.y,
            this.textures,
            merchantItems,
            (merch) => {
              this.openMerchant(merch);
            },
            s.scale ?? 0.72
          );
          this.entities.push(merchant);
          continue;
        }

        const def = spriteDefs.get(s.textureId);
        const lootCount = chestIndex % 2 === 0 ? 2 : 3;
        const singleItem = s.itemId ? ItemDatabase.getItemById(s.itemId) : undefined;
        // Un coffre ne peut jamais recevoir l'Homonculus ; seuls les sprites d'items libres (s.textureId !== CHEST) portent leur item unique
        const chestLoot = s.textureId === TILE_TYPE.CHEST
          ? (catalogItems.length > 0
              ? Array.from(
                  { length: lootCount },
                  () => catalogItems[itemCursor++ % catalogItems.length]
                )
              : undefined)
          : (singleItem ? [singleItem] : undefined);

        chestIndex++;

        const sprite = new BillboardSprite(
          s.x,
          s.y,
          s.textureId,
          this.textures,
          s.scale ?? def?.scale ?? 0.42,
          chestLoot,
          (newEntity) => {
            this.entities.push(newEntity);
          }
        );
        this.entities.push(sprite);
      }
    }

    // 3. Spawning des monstres configurés dans le niveau
    if (level.enemies) {
      for (const e of level.enemies) {
        const typeDef = getEnemyType(e.typeId);
        if (typeDef) {
          const enemy = new Enemy(
            e.x,
            e.y,
            typeDef,
            this.player,
            (newEntity) => {
              this.entities.push(newEntity);
            },
            (msg) => {
              this.interactionPrompt.showNotification(msg);
            }
          );
          this.entities.push(enemy);
        }
      }
    }

    // 4. Spawning des portails d'extraction
    if (level.extractions) {
      for (const ext of level.extractions) {
        const portal = new ExtractionPortal(
          ext.x,
          ext.y,
          ext.name,
          ext.activationDelaySec ?? 45,
          (port) => {
            this.handleExtraction(port);
          }
        );
        this.entities.push(portal);
      }
    }
  }

  private handleExtraction(portal: ExtractionPortal): void {
    if (this.isExtracted) {
      return;
    }
    this.isExtracted = true;

    // L'Homonculus ne peut pas être extrait du niveau : il se dissout immédiatement dans le vortex
    this.lostHomonculusOnExtract = this.player.inventory.hasItem('offhand');
    if (this.lostHomonculusOnExtract) {
      this.player.inventory.unequip('offhand');
    }

    // Les clés de la crypte sont également consommées/abandonnées à l'extraction
    this.player.inventory.unequip('key');

    this.interactionPrompt.showNotification(
      this.lostHomonculusOnExtract
        ? `EXTRACTION : L'HOMONCULUS N'A PAS PU QUITTER LE NIVEAU !`
        : `EXTRACTION RÉUSSIE : ${portal.name.toUpperCase()} !`
    );
  }

  private openMerchant(merchant: Merchant): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.input.setPaused(true);
    this.pauseMenu.hide();

    this.merchantUI.open(
      merchant,
      (item) => {
        const replaced = this.player.pickupItem(item);
        if (replaced) {
          const dropOrb = new DroppedItemOrb(
            this.player.x,
            this.player.y,
            merchant.x + (Math.random() - 0.5) * 0.4,
            merchant.y + (Math.random() - 0.5) * 0.4,
            replaced,
            (newEnt) => this.entities.push(newEnt)
          );
          this.entities.push(dropOrb);
        }
        this.interactionPrompt.showNotification(`OBTENU : ${item.name.toUpperCase()} !`);
      },
      () => {
        this.isPaused = false;
        this.input.setPaused(false);
      }
    );
  }

  private generateMerchantItems(x: number, y: number): EquipmentItem[] {
    const center = Math.floor(MapGenerator.DEFAULT_SIZE / 2);
    const distFromCenter = Math.hypot(x - center, y - center);
    const pool = [...ItemDatabase.getChestLootPool()];

    // Zone 3 (Sanctuaire central, r <= 6) : privilégie les objets rares, épiques, légendaires et artéfacts
    if (distFromCenter <= 6) {
      const rarityRank: Record<string, number> = {
        artifact: 5,
        legendary: 4,
        epic: 3,
        rare: 2,
        uncommon: 1,
        common: 0,
      };
      pool.sort((a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0));
    } else {
      // Zone 2 : mélange aléatoire
      pool.sort(() => Math.random() - 0.5);
    }

    const chosen: EquipmentItem[] = [];
    const usedSlots = new Set<string>();

    for (const item of pool) {
      if (chosen.length >= 3) break;
      if (!usedSlots.has(item.slot)) {
        chosen.push(item);
        usedSlots.add(item.slot);
      }
    }

    for (const item of pool) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(item)) {
        chosen.push(item);
      }
    }

    return chosen;
  }

  public startNewExtractionMatch(): void {
    WalletManager.resetSessionCoins();
    if (this.player.inventory.getItem('offhand')?.id === 'offhand_homonculus') {
      this.player.inventory.unequip('offhand');
    }
    this.player.inventory.unequip('key');
    const newMap = MapGenerator.generate();
    this.loadLevel(newMap);
    this.interactionPrompt.showNotification('NOUVELLE EXPÉDITION DÉMARRÉE !');
  }

  public openHub(tab: 'play' | 'equipment' | 'shop' | 'quests' = 'play'): void {
    this.isInMainMenu = false;
    this.isInHub = true;
    this.isPaused = true;
    this.input.setPaused(true, false);
    this.mainMenu.hide();
    this.pauseMenu.hide();
    this.merchantUI.close();
    this.interactionPrompt.clear();
    this.worldBillboardOverlay.setVisible(false);
    this.hudOverlay.setVisible(false);
    this.hudOverlay.reset();
    this.playerHandOverlay.setVisible(false);
    this.hubUI.setPlayer(this.player);
    this.hubUI.show(tab);
  }

  public returnToHub(): void {
    if (!this.player.isAlive()) {
      this.player.inventory.clear();
    } else if (this.isExtracted) {
      QuestManager.onExtraction(WalletManager.getSessionCoins());
    }

    this.openHub('play');
  }

  public startRaidFromHub(): void {
    WalletManager.resetSessionCoins();
    this.isInHub = false;
    this.isInMainMenu = false;
    this.hubUI.hide();
    this.mainMenu.hide();
    this.pauseMenu.hide();
    this.startNewExtractionMatch();
    this.isPaused = false;
    this.worldBillboardOverlay.setVisible(true);
    this.hudOverlay.setVisible(true);
    this.playerHandOverlay.setVisible(true);
    this.input.setPaused(false);
  }

  public startGameFromMenu(): void {
    this.openHub();
  }

  public returnToMainMenu(): void {
    this.isInMainMenu = true;
    this.isInHub = false;
    this.hubUI.hide();
    this.pauseMenu.hide();
    this.merchantUI.close();
    this.interactionPrompt.clear();
    this.isPaused = true;
    this.worldBillboardOverlay.setVisible(false);
    this.hudOverlay.setVisible(false);
    this.playerHandOverlay.setVisible(false);
    this.input.setPaused(true, false);
    this.mainMenu.show();
  }

  public start(): void {
    if (this.animationFrameId !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private readonly loop = (time: number): void => {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (!this.isPaused && !this.isInMainMenu && !this.isInHub) {
      this.update(dt);
    }
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    if (!this.player.isAlive() || this.isExtracted) {
      // Si le joueur est mort ou s'est extrait, touches R ou Espace pour retourner au campement
      if (
        this.input.consumeKeyPress('r') ||
        this.input.consumeKeyPress(' ') ||
        this.input.consumeKeyPress(KEYS.SHOOT)
      ) {
        this.returnToHub();
      }
      return;
    }

    this.raidTimer += deltaTime;

    this.player.update(deltaTime, this.map);
    this.interactionPrompt.update(deltaTime);

    for (const entity of this.entities) {
      entity.update(deltaTime, this.map);
    }

    // Si le Boss du Sanctuaire est vaincu (Reine de Sang, Roi Gâteau ou Blob Boss), activation immédiate du portail royal
    const boss = this.entities.find(
      (e): e is Enemy =>
        e instanceof Enemy &&
        (e.type.id === 'blob_boss' ||
          e.type.id === 'blood_queen' ||
          e.type.id === 'carrot_cake_king')
    );
    if (boss && !boss.isAlive()) {
      for (const ent of this.entities) {
        if (ent instanceof ExtractionPortal && ent.name.includes('Royal')) {
          ent.activateNow();
        }
      }
    }

    // Détection des collisions boules de feu <-> ennemis vivants
    const flyingFireballs = this.entities.filter(
      (e): e is Fireball => e instanceof Fireball && e.isFlying()
    );
    const aliveEnemies = this.entities.filter(
      (e): e is Enemy => e instanceof Enemy && e.isAlive()
    );

    for (const fb of flyingFireballs) {
      for (const enemy of aliveEnemies) {
        const dist = Math.hypot(fb.x - enemy.x, fb.y - enemy.y);
        if (dist < fb.hitBox + enemy.hitBox) {
          enemy.takeDamage(fb.damage, fb.angle);
          fb.explode();
          break;
        }
      }
    }

    // Détection des collisions orbes violets rebondissants (Clic Droit) <-> ennemis vivants ET joueur (auto-dégâts)
    const flyingPurpleOrbs = this.entities.filter(
      (e): e is PurpleOrb => e instanceof PurpleOrb && e.isFlying()
    );

    for (const orb of flyingPurpleOrbs) {
      let hitTarget = false;

      // 1. Collision avec les ennemis vivants
      for (const enemy of aliveEnemies) {
        const dist = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
        if (dist < orb.hitBox + enemy.hitBox) {
          enemy.takeDamage(orb.damage, orb.angle);
          orb.explode();
          hitTarget = true;
          break;
        }
      }

      if (hitTarget) {
        continue;
      }

      // 2. Collision avec le joueur (dégâts à soi-même après rebond ou délai initial)
      if (orb.canDamageSelf()) {
        const distToPlayer = Math.hypot(orb.x - this.player.x, orb.y - this.player.y);
        if (distToPlayer < orb.hitBox + this.player.hitBox) {
          this.player.takeDamage(orb.damage);
          this.interactionPrompt.showNotification(
            `VOTRE ORBE MAGIQUE VOUS A TOUCHÉ ! (-${orb.damage} PV)`
          );
          orb.explode();
        }
      }
    }

    // Détection des collisions flèches ennemies (Squelette Archer) <-> joueur
    const flyingArrows = this.entities.filter(
      (e): e is Arrow => e instanceof Arrow && e.isFlying()
    );
    for (const arrow of flyingArrows) {
      const dist = Math.hypot(arrow.x - this.player.x, arrow.y - this.player.y);
      if (dist < arrow.hitBox + this.player.hitBox) {
        this.player.takeDamage(arrow.damage);
        arrow.hitTarget();
      }
    }

    // Détection des collisions orbes de sang (Blood Queen - Attaque 1) <-> joueur
    const flyingBloodOrbs = this.entities.filter(
      (e): e is BloodOrb => e instanceof BloodOrb && e.isFlying()
    );
    for (const orb of flyingBloodOrbs) {
      const dist = Math.hypot(orb.x - this.player.x, orb.y - this.player.y);
      if (dist < orb.hitBox + this.player.hitBox) {
        this.player.takeDamage(orb.damage);
        orb.hitTarget();
      }
    }

    // Détection des collisions ondes de sang à 360° (Blood Queen - Attaque 2) <-> joueur
    // Seuls les murs/piliers arrêtent les segments d'onde ; si le joueur est touché, un seul impact par vague est comptabilisé
    const activeWaveSegments = this.entities.filter(
      (e): e is BloodWaveSegment => e instanceof BloodWaveSegment && e.isFlying()
    );
    for (const seg of activeWaveSegments) {
      const dist = Math.hypot(seg.x - this.player.x, seg.y - this.player.y);
      if (dist < seg.hitBox + this.player.hitBox) {
        if (this.lastHitWaveId !== seg.waveId) {
          this.lastHitWaveId = seg.waveId;
          this.player.takeDamage(seg.damage);
          this.interactionPrompt.showNotification(
            `L'ONDE DE SANG VOUS A BALAYÉ ! (-${seg.damage} PV)`
          );
        }
        seg.hitTarget();
      }
    }

    // Détection des flaques de glaçage (Carrot Cake King) ralentissant le joueur
    for (const entity of this.entities) {
      if (entity instanceof FrostingPuddle && entity.active) {
        const dist = Math.hypot(entity.x - this.player.x, entity.y - this.player.y);
        if (dist < entity.hitBox + this.player.hitBox) {
          this.player.applyFrostingSlow(0.35, 0.45);
        }
      }
    }

    this.updateInteraction();

    // Nettoyage des projectiles / entités terminés
    this.entities = this.entities.filter((entity) => entity.active);
  }

  private updateInteraction(): void {
    const target = this.findClosestInteractable();

    if (!target) {
      this.interactionPrompt.setPrompt(null);
      this.input.consumeKeyPress(KEYS.INTERACT);
      return;
    }

    if (this.input.consumeKeyPress(KEYS.INTERACT)) {
      const feedback = target.interact(this.player, this.map);
      if (feedback) {
        this.interactionPrompt.showNotification(feedback);
      }
    }

    if (target.isInteractable()) {
      this.interactionPrompt.setPrompt(target.getInteractionPrompt(this.player));
    } else {
      this.interactionPrompt.setPrompt(null);
    }
  }

  private findClosestInteractable(): Entity | null {
    let bestEntity: Entity | null = null;
    let bestDistance: number = INTERACTION_CONFIG.MAX_DISTANCE;

    for (const entity of this.entities) {
      if (!entity.active || !entity.isInteractable()) {
        continue;
      }

      const dx = entity.x - this.player.x;
      const dy = entity.y - this.player.y;
      const distance = Math.hypot(dx, dy);

      if (distance > bestDistance) {
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - this.player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      // Le joueur doit regarder en direction de l'objet (ou être tout contre lui)
      if (distance <= 0.45 || Math.abs(angleDiff) <= INTERACTION_CONFIG.MAX_ANGLE) {
        bestDistance = distance;
        bestEntity = entity;
      }
    }

    return bestEntity;
  }

  private render(): void {
    this.renderer.render(this.player, this.map, this.entities);
    if (!this.isInMainMenu && !this.isInHub) {
      this.playerHandOverlay.update(this.player, this.renderer, this.isExtracted);
      this.worldBillboardOverlay.update(this.entities, this.player, this.renderer);
      this.hudOverlay.update(
        this.player,
        this.raidTimer,
        this.isExtracted,
        this.lostHomonculusOnExtract
      );
    }
  }
}
