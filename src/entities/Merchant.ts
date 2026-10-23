import { TILE_TYPE } from '../config/constants';
import type { TextureManager } from '../graphics/TextureManager';
import type { EquipmentItem } from '../types';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import type { Player } from './Player';

export interface MysteryCard {
  id: string;
  item: EquipmentItem;
  revealed: boolean;
  refused: boolean;
  taken: boolean;
}

/**
 * Entité Marchand apparaissant dans le monde 3D sous forme de Billboard interactif.
 * Propose au joueur 3 cartes mystère avec choix de révélation et d'acquisition.
 */
export class Merchant extends Entity {
  public readonly textureId = TILE_TYPE.MERCHANT;
  private readonly textureManager: TextureManager;
  private readonly scale: number;
  public readonly cards: MysteryCard[];
  public isClaimed = false;
  private readonly onOpenUI?: (merchant: Merchant, player: Player) => void;

  constructor(
    x: number,
    y: number,
    textureManager: TextureManager,
    items: EquipmentItem[],
    onOpenUI?: (merchant: Merchant, player: Player) => void,
    scale = 0.72
  ) {
    super(x, y, 0, 0.35);
    this.textureManager = textureManager;
    this.scale = scale;
    this.onOpenUI = onOpenUI;
    this.cards = items.slice(0, 3).map((item, index) => ({
      id: `card_${index}_${item.id}`,
      item,
      revealed: false,
      refused: false,
      taken: false,
    }));
  }

  public update(_deltaTime: number, _map: GameMap): void {
    // Le marchand reste fixe face au joueur
  }

  public override getSprite(): HTMLCanvasElement | null {
    return this.textureManager.getTexture(this.textureId) ?? null;
  }

  public override getScale(): number {
    return this.scale;
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override isInteractable(): boolean {
    return this.active;
  }

  public override getInteractionPrompt(_player?: Player): string | null {
    if (this.isClaimed) {
      return '[F] PARLER AU MARCHAND (AFFAIRE CONCLUE)';
    }
    return '[F] COMMERCER AVEC LE MARCHAND';
  }

  public override interact(player: Player, _map?: GameMap): string | null {
    if (this.onOpenUI) {
      this.onOpenUI(this, player);
      return null;
    }
    return null;
  }
}
