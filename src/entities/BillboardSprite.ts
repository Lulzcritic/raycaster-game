import { TILE_TYPE } from '../config/constants';
import { ENEMY_TYPES } from '../config/enemyTypes';
import { ItemDatabase } from '../config/ItemDatabase';
import type { TextureManager } from '../graphics/TextureManager';
import type { EquipmentItem } from '../types';
import { findSpacedDropPositions } from '../utils/dropSpread';
import type { GameMap } from '../world/GameMap';
import { DroppedItemOrb } from './DroppedItemOrb';
import { Enemy } from './Enemy';
import { Entity } from './Entity';
import type { Player } from './Player';

/**
 * Entité 2D de type "Billboard" (toujours orientée face au joueur dans le monde 3D)
 */
export class BillboardSprite extends Entity {
  public readonly textureId: number;
  private readonly textureManager: TextureManager;
  private readonly scale: number;
  private lootItems: EquipmentItem[];
  private readonly onSpawnEntity?: (entity: Entity) => void;
  private isOpened = false;
  private openProgress = 0;
  private lastRenderedLift = -1;
  private openedCanvas: HTMLCanvasElement | null = null;

  constructor(
    x: number,
    y: number,
    textureId: number,
    textureManager: TextureManager,
    scale = 0.42,
    lootItems?: EquipmentItem[] | EquipmentItem,
    onSpawnEntity?: (entity: Entity) => void
  ) {
    super(x, y, 0, 0);
    this.textureId = textureId;
    this.textureManager = textureManager;
    this.scale = scale;
    this.lootItems = Array.isArray(lootItems)
      ? [...lootItems]
      : lootItems
        ? [lootItems]
        : [];

    // Règle stricte : un coffre ne peut JAMAIS renfermer l'Homonculus (trouvé uniquement seul sur la carte)
    if (this.textureId === TILE_TYPE.CHEST && this.lootItems.length > 0) {
      this.lootItems = this.lootItems.filter(
        (item) => item.id !== 'offhand_homonculus' && item.slot !== 'offhand'
      );
    }

    this.onSpawnEntity = onSpawnEntity;
  }

  public hasLoot(): boolean {
    return this.lootItems.length > 0;
  }

  public isChestOpened(): boolean {
    return this.isOpened;
  }

  public update(deltaTime: number, _map: GameMap): void {
    if (this.isOpened && this.openProgress < 1) {
      this.openProgress = Math.min(1, this.openProgress + deltaTime * 8);
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    const baseSprite = this.textureManager.getTexture(this.textureId) ?? null;
    if (!baseSprite) {
      return null;
    }

    if (this.textureId === TILE_TYPE.CHEST && this.isOpened) {
      return this.getOpenedChestSprite(baseSprite);
    }

    return baseSprite;
  }

  public override getScale(): number {
    return this.scale;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override isInteractable(): boolean {
    if (!this.active) {
      return false;
    }
    if (this.textureId === TILE_TYPE.CHEST) {
      return !this.isOpened;
    }
    if (this.textureId === TILE_TYPE.HOMONCULUS) {
      return this.active;
    }
    return false;
  }

  public override getInspectedItem(): EquipmentItem | null {
    if (this.textureId === TILE_TYPE.HOMONCULUS && this.active) {
      return this.lootItems[0] ?? ItemDatabase.getItemById('offhand_homonculus') ?? null;
    }
    return null;
  }

  public override getInteractionPrompt(player?: Player): string | null {
    if (!this.isInteractable()) {
      return null;
    }
    if (this.textureId === TILE_TYPE.CHEST) {
      return '[F] OUVRIR LE COFFRE';
    }
    if (this.textureId === TILE_TYPE.HOMONCULUS) {
      const isEquipped = player ? player.inventory.hasItem('offhand') : false;
      const item = this.getInspectedItem();
      const itemName = item?.name.toUpperCase() ?? 'HOMONCULUS';
      return isEquipped
        ? `[F] REMPLACER PAR : ${itemName} (MAIN GAUCHE)`
        : `[F] PRENDRE : ${itemName} (MAIN GAUCHE)`;
    }
    return null;
  }

  public override interact(player: Player, map?: GameMap): string | null {
    if (!this.isInteractable()) {
      return null;
    }

    if (this.textureId === TILE_TYPE.HOMONCULUS) {
      const item = this.getInspectedItem() ?? ItemDatabase.getItemById('offhand_homonculus');
      if (!item) {
        return null;
      }

      const replaced = player.pickupItem(item);
      this.active = false;

      if (replaced && this.onSpawnEntity) {
        const replacementOrb = new DroppedItemOrb(
          player.x,
          player.y,
          this.x,
          this.y,
          replaced,
          this.onSpawnEntity
        );
        this.onSpawnEntity(replacementOrb);
      }

      return replaced
        ? `REMPLACÉ : ${item.name.toUpperCase()} (ANCIEN AU SOL)`
        : `OBTENU : ${item.name.toUpperCase()} (MAIN GAUCHE)`;
    }

    this.isOpened = true;

    // Un coffre a 1 chance sur 4 de se transformer en Mimic s'il ne contient pas de clé essentielle
    const hasKey = this.lootItems.some((item) => item.slot === 'key');
    const isMimic = !hasKey && Math.random() < 0.25;

    if (isMimic) {
      this.active = false;
      this.lootItems = [];

      if (this.onSpawnEntity) {
        const mimicType = ENEMY_TYPES.mimic;
        const mimic = new Enemy(
          this.x,
          this.y,
          mimicType,
          player,
          this.onSpawnEntity
        );
        mimic.state = 'aggro';
        mimic.setAttackCooldown(0.5); // 0.5s de fenêtre de réaction pour le joueur
        this.onSpawnEntity(mimic);
      }

      return 'ATTENTION : LE COFFRE ÉTAIT UN MIMIC !';
    }

    if (this.lootItems.length === 0) {
      return 'COFFRE VIDE...';
    }

    if (this.onSpawnEntity && map) {
      const positions = findSpacedDropPositions(
        this.x,
        this.y,
        player.x,
        player.y,
        this.lootItems.length,
        map
      );

      for (let i = 0; i < this.lootItems.length; i++) {
        const item = this.lootItems[i];
        const targetPos = positions[i] ?? { x: this.x, y: this.y };
        const orb = new DroppedItemOrb(
          this.x,
          this.y,
          targetPos.x,
          targetPos.y,
          item,
          this.onSpawnEntity
        );
        this.onSpawnEntity(orb);
      }
    }

    const count = this.lootItems.length;
    this.lootItems = [];
    return count > 1 ? `${count} OBJETS TOMBENT AU SOL !` : null;
  }

  /**
   * Génère la variante ouverte du coffre directement à partir de sa texture pixel-art chargée
   */
  private getOpenedChestSprite(closedSprite: HTMLCanvasElement): HTMLCanvasElement {
    const maxLift = 6;
    const lift = Math.max(1, Math.round(maxLift * this.openProgress));

    if (this.openedCanvas && this.lastRenderedLift === lift) {
      return this.openedCanvas;
    }

    const width = closedSprite.width;
    const height = closedSprite.height;
    const splitY = Math.floor(height * 0.55); // Ligne des charnières du coffre (35/64)

    if (!this.openedCanvas) {
      this.openedCanvas = document.createElement('canvas');
      this.openedCanvas.width = width;
      this.openedCanvas.height = height;
    }

    const ctx = this.openedCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    // 1. Base inférieure du coffre (fixe sur le sol)
    ctx.drawImage(
      closedSprite,
      0,
      splitY,
      width,
      height - splitY,
      0,
      splitY,
      width,
      height - splitY
    );

    // 2. Cavité intérieure sombre entre le couvercle soulevé et la base
    ctx.fillStyle = '#08080a';
    ctx.fillRect(2, splitY - lift, width - 4, lift + 1);
    ctx.fillStyle = '#160d09';
    ctx.fillRect(4, splitY - lift + 1, width - 8, Math.max(1, lift - 1));
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(4, splitY - 1, width - 8, 1);

    // 3. Couvercle supérieur soulevé vers le haut
    const lidTopY = Math.max(0, 14 - lift);
    const lidSourceH = splitY - 14;
    ctx.drawImage(
      closedSprite,
      0,
      14,
      width,
      lidSourceH,
      0,
      lidTopY,
      width,
      lidSourceH
    );

    this.lastRenderedLift = lift;
    return this.openedCanvas;
  }
}
