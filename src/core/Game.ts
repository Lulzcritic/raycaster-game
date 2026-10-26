import {
  INTERACTION_CONFIG,
  KEYS,
  PURPLE_ORB_CONFIG,
  TEXTURE_DEFINITIONS,
  TILE_TYPE,
} from '../config/constants';
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
import type {
  EquipmentItem,
  EquipmentSlot,
  LevelData,
  TextureDefinition,
} from '../types';
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
import { RemotePlayer } from '../entities/RemotePlayer';
import { PlayerSpriteManager } from '../graphics/PlayerSpriteManager';
import { NetworkClient } from '../network/NetworkClient';
import { findSpacedDropPositions } from '../utils/dropSpread';
import { WalletManager } from './WalletManager';
import { GearScoreService } from './GearScoreService';
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

  // Multijoueur temps réel (Phase 2 & Phase 3)
  private currentInstanceId: string | null = null;
  private localPlayerId: string | null = null;
  private networkTickTimer = 0;
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private hasSentDeathNotification = false;
  private hasSentBossDefeated = false;

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
        if (this.currentInstanceId) {
          if (projectile instanceof Fireball) {
            NetworkClient.getInstance().sendPlayerShoot({
              instanceId: this.currentInstanceId,
              spellType: 'fireball',
              originX: projectile.x,
              originY: projectile.y,
              angle: projectile.angle,
              damage: projectile.damage,
            });
          } else if (projectile instanceof PurpleOrb) {
            NetworkClient.getInstance().sendPlayerShoot({
              instanceId: this.currentInstanceId,
              spellType: 'purple_orb',
              originX: projectile.x,
              originY: projectile.y,
              angle: projectile.angle,
              damage: projectile.baseDamage,
            });
          }
        }
      }
    );

    this.setupNetworkListeners();

    this.hubUI = new HubUI(
      (matchOptions) => {
        this.startRaidFromHub(matchOptions);
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

  private setupNetworkListeners(): void {
    const net = NetworkClient.getInstance();

    net.onInstancePlayers((data) => {
      if (!this.currentInstanceId) return;

      for (const p of data.players) {
        if (p.id === this.localPlayerId) continue;

        let remote = this.remotePlayers.get(p.id);
        if (!remote) {
          remote = new RemotePlayer(
            p.id,
            p.name,
            p.skinId,
            p.gearScore,
            p.x,
            p.y,
            p.angle,
            p.hp,
            p.maxHp
          );
          this.remotePlayers.set(p.id, remote);
          this.entities.push(remote);
        } else {
          remote.updateNetworkState(
            p.x,
            p.y,
            p.angle,
            p.isMoving,
            p.isAttacking,
            p.hp,
            p.maxHp
          );
        }
      }
    });

    net.onRemoteShoot((data) => {
      if (!this.currentInstanceId) return;

      if (data.spellType === 'fireball') {
        const fb = new Fireball(data.originX, data.originY, data.angle, data.damage, data.shooterId);
        this.entities.push(fb);
      } else if (data.spellType === 'purple_orb') {
        const orb = new PurpleOrb(
          data.originX,
          data.originY,
          data.angle,
          data.damage,
          undefined,
          data.shooterId
        );
        this.entities.push(orb);
      }
    });

    net.onPlayerLeft((data) => {
      const remote = this.remotePlayers.get(data.playerId);
      if (remote) {
        remote.active = false;
        this.remotePlayers.delete(data.playerId);
        this.interactionPrompt.showNotification(`👤 ${remote.name} a quitté la Citadelle.`);
      }
    });

    net.onRemoteChestOpened((data) => {
      if (!this.currentInstanceId) return;

      const chest = this.entities.find(
        (e): e is BillboardSprite =>
          e instanceof BillboardSprite &&
          Math.hypot(e.x - data.x, e.y - data.y) < 0.6
      );

      if (chest) {
        chest.openFromRemote(data.isMimic, data.items, data.dropPositions, this.player);
      } else if (!data.isMimic && data.items.length > 0) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const pos = data.dropPositions[i] ?? {
            startX: data.x,
            startY: data.y,
            targetX: data.x,
            targetY: data.y,
          };
          const orb = new DroppedItemOrb(
            pos.startX,
            pos.startY,
            pos.targetX,
            pos.targetY,
            item,
            (newEnt) => {
              if (newEnt instanceof DroppedItemOrb) this.attachItemOrbCallbacks(newEnt);
              this.entities.push(newEnt);
            }
          );
          this.attachItemOrbCallbacks(orb);
          this.entities.push(orb);
        }
      }

      this.interactionPrompt.showNotification(
        data.isMimic
          ? `⚠️ ${data.openerName.toUpperCase()} A RÉVEILLÉ UN MIMIC !`
          : `🎁 ${data.openerName.toUpperCase()} A OUVERT UN COFFRE !`
      );
    });

    net.onRemoteItemPickedUp((data) => {
      if (!this.currentInstanceId) return;

      const orb = this.entities.find(
        (e): e is DroppedItemOrb =>
          e instanceof DroppedItemOrb &&
          e.active &&
          ((e.item.instanceId && e.item.instanceId === data.itemInstanceId) ||
            Math.hypot(e.x - data.x, e.y - data.y) < 0.45)
      );

      if (orb) {
        orb.active = false;
      }

      this.interactionPrompt.showNotification(
        `💎 ${data.pickerName} A RAMASSÉ : ${data.itemName.toUpperCase()} !`
      );
    });

    net.onRemoteItemDropped((data) => {
      if (!this.currentInstanceId) return;

      const orb = new DroppedItemOrb(
        data.startX,
        data.startY,
        data.targetX,
        data.targetY,
        data.item,
        (newEnt) => {
          if (newEnt instanceof DroppedItemOrb) this.attachItemOrbCallbacks(newEnt);
          this.entities.push(newEnt);
        }
      );
      this.attachItemOrbCallbacks(orb);
      this.entities.push(orb);

      this.interactionPrompt.showNotification(
        `📦 ${data.dropperName} A LAISSÉ : ${data.item.name.toUpperCase()} AU SOL.`
      );
    });

    net.onRemoteDoorOpened((data) => {
      if (!this.currentInstanceId) return;

      const door = this.entities.find(
        (e): e is Door =>
          e instanceof Door &&
          e.tileX === data.tileX &&
          e.tileY === data.tileY
      );

      if (door) {
        door.openFromRemote();
      }

      this.interactionPrompt.showNotification(
        `🚪 ${data.openerName.toUpperCase()} A DÉVERROUILLÉ UNE GRANDE PORTE !`
      );
    });

    net.onRemotePlayerExtracted((data) => {
      if (!this.currentInstanceId) return;

      const remote = this.remotePlayers.get(data.playerId);
      if (remote) {
        remote.active = false;
        this.remotePlayers.delete(data.playerId);
      }

      this.interactionPrompt.showNotification(
        `🏆 ${data.playerName.toUpperCase()} S'EST EXTRAIT AVEC SUCCÈS (${data.portalName.toUpperCase()}) !`
      );
    });

    net.onRemotePlayerDied((data) => {
      if (!this.currentInstanceId) return;

      const remote = this.remotePlayers.get(data.playerId);
      if (remote) {
        remote.active = false;
      }

      this.interactionPrompt.showNotification(
        `💀 ${data.playerName.toUpperCase()} A PÉRI DANS LA CITADELLE...`
      );

      if (data.droppedItems && data.droppedItems.length > 0) {
        const positions = findSpacedDropPositions(
          data.x,
          data.y,
          this.player.x,
          this.player.y,
          data.droppedItems.length,
          this.map
        );

        for (let i = 0; i < data.droppedItems.length; i++) {
          const item = data.droppedItems[i];
          const pos = positions[i] ?? { x: data.x, y: data.y };
          const orb = new DroppedItemOrb(
            data.x,
            data.y,
            pos.x,
            pos.y,
            item,
            (newEnt) => {
              if (newEnt instanceof DroppedItemOrb) this.attachItemOrbCallbacks(newEnt);
              this.entities.push(newEnt);
            }
          );
          this.attachItemOrbCallbacks(orb);
          this.entities.push(orb);
        }
      }
    });

    net.onRemoteBossDefeated((data) => {
      if (!this.currentInstanceId) return;

      for (const ent of this.entities) {
        if (ent instanceof ExtractionPortal && ent.name.includes('Royal')) {
          ent.activateNow();
        }
      }

      this.interactionPrompt.showNotification(
        `👑 LE BOSS DU SANCTUAIRE (${data.bossName.toUpperCase()}) A ÉTÉ TERRASSÉ ! LE PORTAIL ROYAL EST OUVERT !`
      );
    });

    net.onRemotePlayerPing((data) => {
      if (!this.currentInstanceId) return;

      this.worldBillboardOverlay.addTacticalPing(data.x, data.y, data.senderName, data.label);
      this.interactionPrompt.showNotification(`📍 ${data.senderName} SIGNALE UN LIEU D'INTÉRÊT !`);
    });
  }

  private attachItemOrbCallbacks(orb: DroppedItemOrb): void {
    orb.onPickupCallback = (item, x, y, replaced, dropTargetX, dropTargetY) => {
      if (this.currentInstanceId) {
        NetworkClient.getInstance().sendItemPickedUp({
          instanceId: this.currentInstanceId,
          itemInstanceId: item.instanceId ?? item.id,
          itemName: item.name,
          x,
          y,
        });

        if (replaced && dropTargetX !== undefined && dropTargetY !== undefined) {
          NetworkClient.getInstance().sendItemDropped({
            instanceId: this.currentInstanceId,
            item: replaced,
            startX: this.player.x,
            startY: this.player.y,
            targetX: dropTargetX,
            targetY: dropTargetY,
          });
        }
      }
    };
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
      PlayerSpriteManager.preloadAll(),
    ]);
  }

  public loadLevel(level: LevelData): void {
    this.currentLevel = level;
    this.raidTimer = 0;
    this.isExtracted = false;
    this.lostHomonculusOnExtract = false;
    this.hasSentDeathNotification = false;
    this.hasSentBossDefeated = false;
    this.map = new GameMap(level.grid, level.floorGrid, level.skyTileId);
    this.player.x = level.playerSpawn.x;
    this.player.y = level.playerSpawn.y;
    this.player.angle = level.playerSpawn.angle;
    this.player.maxHealth = 100 + this.player.getEffectiveStats().maxHealth;
    this.player.health = this.player.maxHealth;
    this.entities = [];

    // Ré-ancrage des joueurs distants présents dans l'instance
    for (const remote of this.remotePlayers.values()) {
      if (remote.active) {
        this.entities.push(remote);
      }
    }

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

    const playerGS = this.player ? this.player.getGearScore() : 50;
    let chestIndex = 0;

    // 1. Détection automatique des IDs de tuiles et sprites placés directement dans la grille du niveau
    for (let row = 0; row < level.grid.length; row++) {
      for (let col = 0; col < level.grid[row].length; col++) {
        const tileId = level.grid[row][col];

        // Spawning de la porte verrouillée avec sa clé correspondante
        if (tileId === TILE_TYPE.DOOR) {
          const doorConfig = level.doors?.find((d) => d.x === col && d.y === row);
          const requiredKey = doorConfig?.requiredKeyId ?? 'key_crypt_skull';
          const door = new Door(col, row, this.textures, requiredKey);
          door.onDoorOpenedCallback = (tileX, tileY) => {
            if (this.currentInstanceId) {
              NetworkClient.getInstance().sendDoorOpened({
                instanceId: this.currentInstanceId,
                tileX,
                tileY,
              });
            }
          };
          this.entities.push(door);
          continue;
        }

        const def = spriteDefs.get(tileId);
        if (def) {
          const coordKey = `${col},${row}`;
          const rawChestLoot = level.chestLoots?.[coordKey];
          let chestLoot: EquipmentItem[] | undefined;

          if (rawChestLoot && rawChestLoot.length > 0) {
            chestLoot = rawChestLoot
              .map((it) =>
                typeof it === 'string'
                  ? ItemDatabase.getItemById(it)
                  : (it as EquipmentItem)
              )
              .filter(
                (item): item is EquipmentItem =>
                  item !== undefined && item.id !== 'offhand_homonculus'
              );
          } else if (tileId === TILE_TYPE.CHEST) {
            const lootCount = chestIndex % 2 === 0 ? 2 : 3;
            const items: EquipmentItem[] = [];
            for (let k = 0; k < lootCount; k++) {
              const rarity = GearScoreService.rollRarityForGearScore(playerGS);
              const tpl = ItemDatabase.getRandomItemByRarity(rarity);
              if (tpl) {
                items.push(GearScoreService.rollItem(tpl, playerGS));
              }
            }
            chestLoot = items;
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
              if (newEntity instanceof DroppedItemOrb) {
                this.attachItemOrbCallbacks(newEntity);
              }
              this.entities.push(newEntity);
            }
          );
          if (tileId === TILE_TYPE.CHEST) {
            sprite.onChestOpenedCallback = (x, y, isMimic, items, dropPositions) => {
              if (this.currentInstanceId) {
                NetworkClient.getInstance().sendChestOpened({
                  instanceId: this.currentInstanceId,
                  x,
                  y,
                  isMimic,
                  items,
                  dropPositions,
                });
              }
            };
          }
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
        const singleItem =
          s.item ?? (s.itemId ? ItemDatabase.getItemById(s.itemId) : undefined);

        let chestLoot: EquipmentItem[] | undefined;
        if (s.textureId === TILE_TYPE.CHEST) {
          const items: EquipmentItem[] = [];
          for (let k = 0; k < lootCount; k++) {
            const rarity = GearScoreService.rollRarityForGearScore(playerGS);
            const tpl = ItemDatabase.getRandomItemByRarity(rarity);
            if (tpl) {
              items.push(GearScoreService.rollItem(tpl, playerGS));
            }
          }
          chestLoot = items;
        } else if (singleItem) {
          chestLoot = [singleItem];
        }

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
              if (newEntity instanceof DroppedItemOrb) {
                this.attachItemOrbCallbacks(newEntity);
              }
              this.entities.push(newEntity);
            },
            (msg) => {
              this.interactionPrompt.showNotification(msg);
            }
          );
          if (level.difficulty) {
            enemy.scaleStats(
              level.difficulty.hpMultiplier,
              level.difficulty.damageMultiplier
            );
          }
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

    if (this.currentInstanceId) {
      NetworkClient.getInstance().sendPlayerExtracted({
        instanceId: this.currentInstanceId,
        portalName: portal.name,
      });
    }

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
          const dropTargetX = merchant.x + (Math.random() - 0.5) * 0.4;
          const dropTargetY = merchant.y + (Math.random() - 0.5) * 0.4;
          const dropOrb = new DroppedItemOrb(
            this.player.x,
            this.player.y,
            dropTargetX,
            dropTargetY,
            replaced,
            (newEnt) => {
              if (newEnt instanceof DroppedItemOrb) this.attachItemOrbCallbacks(newEnt);
              this.entities.push(newEnt);
            }
          );
          this.attachItemOrbCallbacks(dropOrb);
          this.entities.push(dropOrb);

          if (this.currentInstanceId) {
            NetworkClient.getInstance().sendItemDropped({
              instanceId: this.currentInstanceId,
              item: replaced,
              startX: this.player.x,
              startY: this.player.y,
              targetX: dropTargetX,
              targetY: dropTargetY,
            });
          }
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
    const playerGs = this.player ? this.player.getGearScore() : 50;

    // Bonus pour le marchand plus proche du sanctuaire central (Zone 3)
    const bonusScore = distFromCenter <= 12 ? 40 : 0;

    const standardSlots: EquipmentSlot[] = ['weapon', 'armor', 'hat', 'boots'];
    const shuffledSlots = [...standardSlots].sort(() => Math.random() - 0.5);

    const chosen: EquipmentItem[] = [];
    for (let i = 0; i < 3; i++) {
      const slot = shuffledSlots[i % shuffledSlots.length];
      const rarity = GearScoreService.rollRarityForGearScore(playerGs, bonusScore);
      const tpl =
        ItemDatabase.getRandomItemByRarity(rarity, slot) ??
        ItemDatabase.getRandomItemByRarity(rarity);
      if (tpl) {
        chosen.push(GearScoreService.rollItem(tpl, playerGs));
      }
    }

    return chosen;
  }

  public startNewExtractionMatch(options?: { seed?: number; spawnIndex?: number }): void {
    WalletManager.resetSessionCoins();
    if (this.player.inventory.getItem('offhand')?.id === 'offhand_homonculus') {
      this.player.inventory.unequip('offhand');
    }
    this.player.inventory.unequip('key');
    const playerGearScore = this.player.getGearScore();
    const newMap = MapGenerator.generate({
      playerGearScore,
      seed: options?.seed,
      spawnIndex: options?.spawnIndex,
    });
    this.loadLevel(newMap);
    const diff = newMap.difficulty;
    const hpPct = diff ? Math.round((diff.hpMultiplier - 1) * 100) : 0;
    const matchPrefix = options?.seed !== undefined ? 'CONVOI MULTIJOUEUR' : 'EXPÉDITION';
    this.interactionPrompt.showNotification(
      `${matchPrefix} DANS LA CITADELLE (Puissance : ${playerGearScore} ⭐ | Monstres +${hpPct}%)`
    );
  }

  public openHub(tab: 'play' | 'equipment' | 'shop' | 'quests' = 'play'): void {
    if (this.currentInstanceId) {
      NetworkClient.getInstance().leaveMatch(this.currentInstanceId);
      this.currentInstanceId = null;
      this.localPlayerId = null;
      for (const remote of this.remotePlayers.values()) {
        remote.active = false;
      }
      this.remotePlayers.clear();
    }

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

  public startRaidFromHub(options?: {
    seed?: number;
    spawnIndex?: number;
    instanceId?: string;
    localPlayerId?: string;
  }): void {
    WalletManager.resetSessionCoins();
    this.isInHub = false;
    this.isInMainMenu = false;
    this.hubUI.hide();
    this.mainMenu.hide();
    this.pauseMenu.hide();

    if (this.currentInstanceId && this.currentInstanceId !== options?.instanceId) {
      NetworkClient.getInstance().leaveMatch(this.currentInstanceId);
    }
    this.remotePlayers.clear();
    this.currentInstanceId = options?.instanceId ?? null;
    this.localPlayerId = options?.localPlayerId ?? null;

    this.startNewExtractionMatch(options);
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
    if (this.currentInstanceId) {
      NetworkClient.getInstance().leaveMatch(this.currentInstanceId);
      this.currentInstanceId = null;
      this.localPlayerId = null;
      for (const remote of this.remotePlayers.values()) {
        remote.active = false;
      }
      this.remotePlayers.clear();
    }

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
    if (!this.player.isAlive()) {
      if (this.currentInstanceId && !this.hasSentDeathNotification) {
        this.hasSentDeathNotification = true;
        const equipped = this.player.inventory.getAllEquipped();
        NetworkClient.getInstance().sendPlayerDied({
          instanceId: this.currentInstanceId,
          x: this.player.x,
          y: this.player.y,
          droppedItems: equipped,
        });
      }

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

    if (this.isExtracted) {
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

    // Détection du signal tactique rapide (Touche T)
    if (this.input.consumeKeyPress(KEYS.PING)) {
      const pingDist = 3.2;
      const pingX = this.player.x + Math.cos(this.player.angle) * pingDist;
      const pingY = this.player.y + Math.sin(this.player.angle) * pingDist;
      this.worldBillboardOverlay.addTacticalPing(pingX, pingY, 'Vous', 'Signal');
      if (this.currentInstanceId) {
        NetworkClient.getInstance().sendPlayerPing({
          instanceId: this.currentInstanceId,
          x: pingX,
          y: pingY,
          label: 'Signal',
        });
      }
      this.interactionPrompt.showNotification('📍 SIGNAL TACTIQUE PLACÉ !');
    }

    // Envoi de la position locale au serveur à 20 Hz (50ms)
    if (this.currentInstanceId) {
      this.networkTickTimer += deltaTime;
      if (this.networkTickTimer >= 0.05) {
        this.networkTickTimer = 0;
        NetworkClient.getInstance().sendPlayerUpdate({
          instanceId: this.currentInstanceId,
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          isMoving: this.player.isMoving(),
          isAttacking: this.player.isAttacking(),
          hp: this.player.health,
          maxHp: this.player.maxHealth,
        });
      }
    }

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
      if (this.currentInstanceId && !this.hasSentBossDefeated) {
        this.hasSentBossDefeated = true;
        NetworkClient.getInstance().sendBossDefeated({
          instanceId: this.currentInstanceId,
          bossName: boss.type.name,
        });
      }
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
      // 1. Collision avec ennemis vivants
      for (const enemy of aliveEnemies) {
        const dist = Math.hypot(fb.x - enemy.x, fb.y - enemy.y);
        if (dist < fb.hitBox + enemy.hitBox) {
          enemy.takeDamage(fb.damage, fb.angle);
          fb.explode();
          break;
        }
      }

      // 2. Collision avec le joueur local (tir adverse d'un autre joueur)
      if (fb.isFlying() && fb.shooterId && fb.shooterId !== this.localPlayerId) {
        const distToPlayer = Math.hypot(fb.x - this.player.x, fb.y - this.player.y);
        if (distToPlayer < fb.hitBox + this.player.hitBox) {
          this.player.takeDamage(fb.damage);
          this.interactionPrompt.showNotification(`💥 TOUCHÉ PAR UNE BOULE DE FEU ! (-${fb.damage} PV)`);
          fb.explode();
        }
      }

      // 3. Collision visuelle avec joueurs distants
      if (fb.isFlying()) {
        for (const remote of this.remotePlayers.values()) {
          if (!remote.active || remote.hp <= 0) continue;
          const dist = Math.hypot(fb.x - remote.x, fb.y - remote.y);
          if (dist < fb.hitBox + remote.hitBox) {
            fb.explode();
            break;
          }
        }
      }
    }

    // Détection des collisions orbes violets rebondissants (Clic Droit) <-> ennemis vivants ET joueur (auto-dégâts / PvP)
    const flyingPurpleOrbs = this.entities.filter(
      (e): e is PurpleOrb => e instanceof PurpleOrb && e.isFlying()
    );

    for (const orb of flyingPurpleOrbs) {
      let hitTarget = false;

      // 1. Collision avec les ennemis vivants
      for (const enemy of aliveEnemies) {
        const dist = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
        if (dist < orb.hitBox + enemy.hitBox) {
          const dmg = orb.damage;
          enemy.takeDamage(dmg, orb.angle);
          if (orb.bouncesDone >= 1) {
            const bonusPct = Math.round(
              orb.bouncesDone * PURPLE_ORB_CONFIG.BOUNCE_DAMAGE_MULTIPLIER * 100
            );
            const label =
              orb.bouncesDone === 1
                ? `🎯 TRICKSHOT ! (1 rebond : +${bonusPct}% | ${dmg} DÉGÂTS)`
                : `🎯 TRICKSHOT ×${orb.bouncesDone} ! (+${bonusPct}% | ${dmg} DÉGÂTS)`;
            this.interactionPrompt.showNotification(label);
          }
          orb.explode();
          hitTarget = true;
          break;
        }
      }

      if (hitTarget) {
        continue;
      }

      // 2. Collision avec les joueurs distants
      for (const remote of this.remotePlayers.values()) {
        if (!remote.active || remote.hp <= 0) continue;
        const dist = Math.hypot(orb.x - remote.x, orb.y - remote.y);
        if (dist < orb.hitBox + remote.hitBox) {
          orb.explode();
          hitTarget = true;
          break;
        }
      }

      if (hitTarget) {
        continue;
      }

      // 3. Collision avec le joueur local (dégâts d'un projectile adverse OU auto-dégâts après rebond)
      const isRemoteOrb = orb.shooterId && orb.shooterId !== this.localPlayerId;
      if (isRemoteOrb || orb.canDamageSelf()) {
        const distToPlayer = Math.hypot(orb.x - this.player.x, orb.y - this.player.y);
        if (distToPlayer < orb.hitBox + this.player.hitBox) {
          const selfDamage = isRemoteOrb
            ? orb.damage
            : Math.min(orb.damage, Math.round(orb.baseDamage * 1.5));
          this.player.takeDamage(selfDamage);
          const msg = isRemoteOrb
            ? `💥 TOUCHÉ PAR UN ORBE ADVERSE ! (-${selfDamage} PV)`
            : `VOTRE ORBE MAGIQUE VOUS A TOUCHÉ ! (-${selfDamage} PV)`;
          this.interactionPrompt.showNotification(msg);
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
