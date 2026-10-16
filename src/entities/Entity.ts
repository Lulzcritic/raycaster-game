import type { EquipmentItem } from '../types';
import type { GameMap } from '../world/GameMap';
import type { Player } from './Player';

export abstract class Entity {
  public x: number;
  public y: number;
  public angle: number;
  public hitBox: number;
  public active = true;

  constructor(x: number, y: number, angle = 0, hitBox = 0.2) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.hitBox = hitBox;
  }

  public abstract update(deltaTime: number, map: GameMap): void;

  public getSprite(): HTMLCanvasElement | null {
    return null;
  }

  public getScale(): number {
    return 0.5;
  }

  /**
   * Indique si le bas du sprite doit reposer sur le sol (true pour les objets/coffres/PNJ, false pour les projectiles en vol)
   */
  public isFloorAnchored(): boolean {
    return false;
  }

  /**
   * Hauteur d'élévation au-dessus du sol en unités de bloc (0 = posé au sol, > 0 = flottant)
   */
  public getElevation(): number {
    return 0;
  }

  /**
   * Indique si le joueur peut interagir avec cette entité avec la touche F
   */
  public isInteractable(): boolean {
    return false;
  }

  /**
   * Texte affiché en bas au milieu de l'écran lorsque le joueur est proche
   */
  public getInteractionPrompt(_player?: Player): string | null {
    return null;
  }

  /**
   * Objet actuellement inspecté (ex: contenu d'un coffre ouvert en attente d'être pris)
   */
  public getInspectedItem(): EquipmentItem | null {
    return null;
  }

  /**
   * Action déclenchée lorsque le joueur appuie sur F à proximité
   */
  public interact(_player: Player, _map?: GameMap): string | null {
    return null;
  }
}
