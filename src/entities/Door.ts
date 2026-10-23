import { TILE_TYPE } from '../config/constants';
import { ItemDatabase } from '../config/ItemDatabase';
import type { TextureManager } from '../graphics/TextureManager';
import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import type { Player } from './Player';

export class Door extends Entity {
  public readonly tileX: number;
  public readonly tileY: number;
  public readonly requiredKeyId: string;
  private readonly textureManager: TextureManager;
  private isOpened = false;
  private isOpening = false;
  private openProgress = 0;
  private readonly doorFrames: HTMLCanvasElement[];

  constructor(
    tileX: number,
    tileY: number,
    textureManager: TextureManager,
    requiredKeyId = 'key_crypt_skull'
  ) {
    super(tileX + 0.5, tileY + 0.5, 0, 0.4);
    this.tileX = tileX;
    this.tileY = tileY;
    this.textureManager = textureManager;
    this.requiredKeyId = requiredKeyId;
    this.doorFrames = Door.generateAllDoorFrames();
  }

  public override isInteractable(): boolean {
    return this.active && !this.isOpened && !this.isOpening;
  }

  public override getInteractionPrompt(player?: Player): string | null {
    if (this.isOpened || this.isOpening) {
      return null;
    }
    const keyItem = ItemDatabase.getItemById(this.requiredKeyId);
    const keyName = keyItem ? keyItem.name.toUpperCase() : 'CLÉ';
    const hasKey = player ? (player.hasKey(this.requiredKeyId) || player.hasKey()) : false;
    return hasKey
      ? `[F] DÉVERROUILLER LA PORTE (${keyName})`
      : `[F] PORTE VERROUILLÉE (${keyName} REQUISE)`;
  }

  public override interact(player: Player, _map?: GameMap): string | null {
    if (this.isOpened || this.isOpening) {
      return null;
    }

    const keyItem = ItemDatabase.getItemById(this.requiredKeyId);
    const keyName = keyItem ? keyItem.name : 'la clé requise';

    if (player.hasKey(this.requiredKeyId) || player.hasKey()) {
      player.useKey(this.requiredKeyId);
      this.isOpening = true;
      this.openProgress = 0;
      return 'PORTE DÉVERROUILLÉE !';
    }

    return `PORTE VERROUILLÉE ! IL VOUS FAUT : ${keyName}.`;
  }

  public override update(deltaTime: number, map: GameMap): void {
    if (this.isOpening) {
      this.openProgress = Math.min(1, this.openProgress + deltaTime * 3.5);

      const frameIdx = Math.min(
        this.doorFrames.length - 1,
        Math.floor(this.openProgress * this.doorFrames.length)
      );
      this.textureManager.registerTexture(TILE_TYPE.DOOR, this.doorFrames[frameIdx]);

      if (this.openProgress >= 1) {
        this.isOpening = false;
        this.isOpened = true;
        this.active = false;
        // La case devient un sol praticable (ouvre le passage)
        map.setTile(this.tileX, this.tileY, TILE_TYPE.GROUND_1);
        // Réinitialise la texture de la porte fermée pour les autres portes du donjon
        this.textureManager.registerTexture(TILE_TYPE.DOOR, this.doorFrames[0]);
      }
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    return null;
  }

  /**
   * Génère la texture 64x64 de base de la porte fermée
   */
  public static createClosedDoorTexture(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    Door.renderDoorFrame(ctx, 0);
    return canvas;
  }

  /**
   * Génère les 4 frames d'animation pour l'ouverture de la porte
   */
  private static generateAllDoorFrames(): HTMLCanvasElement[] {
    const frames: HTMLCanvasElement[] = [];
    const steps = [0, 0.28, 0.62, 0.95];

    for (const step of steps) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      Door.renderDoorFrame(ctx, step);
      frames.push(canvas);
    }

    return frames;
  }

  private static renderDoorFrame(
    ctx: CanvasRenderingContext2D,
    progress: number
  ): void {
    // 1. Fond sombre de la baie / passage intérieur
    ctx.fillStyle = '#0c0a12';
    ctx.fillRect(0, 0, 64, 64);

    // Si la porte est en cours d'ouverture, on dessine la perspective du sol et du fond
    if (progress > 0) {
      ctx.fillStyle = '#16141f';
      ctx.fillRect(4, 4, 56, 56);
      ctx.fillStyle = '#221f2d';
      ctx.fillRect(8, 36, 48, 24);
    }

    // 2. Largeur d'écartement central selon l'avancement
    const gap = Math.round(progress * 48);
    const leftWidth = Math.max(0, 26 - Math.floor(gap / 2));
    const rightStart = 34 + Math.floor(gap / 2);
    const rightWidth = Math.max(0, 60 - rightStart);

    // Dessin du vantail gauche
    if (leftWidth > 2) {
      Door.renderDoorLeaf(ctx, 4, 4, leftWidth, 56, 'left', progress);
    }

    // Dessin du vantail droit
    if (rightWidth > 2) {
      Door.renderDoorLeaf(ctx, rightStart, 4, rightWidth, 56, 'right', progress);
    }

    // 3. Cadre en pierre sculptée tout autour (arc et montants)
    Door.renderStoneArch(ctx);

    // 4. Effet d'étincelles magiques à l'instant où la clé tourne (progress ~0.28)
    if (progress > 0.1 && progress < 0.5) {
      ctx.fillStyle = 'rgba(255, 238, 102, 0.95)';
      ctx.fillRect(31, 33, 2, 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillRect(31, 32, 2, 1);
      ctx.fillRect(31, 35, 2, 1);
      ctx.fillRect(30, 33, 1, 2);
      ctx.fillRect(33, 33, 1, 2);
    }
  }

  private static renderDoorLeaf(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    side: 'left' | 'right',
    progress: number
  ): void {
    // Teinte de base des planches de chêne sombre vieilli
    ctx.fillStyle = '#32251b';
    ctx.fillRect(x, y, width, height);

    // Rainures verticales des planches
    ctx.fillStyle = '#1c140e';
    for (let px = x + 6; px < x + width; px += 7) {
      ctx.fillRect(px, y, 1, height);
    }

    // Lignes de grain du bois
    ctx.fillStyle = '#3f2f22';
    for (let py = y + 4; py < y + height; py += 6) {
      ctx.fillRect(x + 1, py, width - 2, 1);
    }

    // Ferrure supérieure en fer forgé
    ctx.fillStyle = '#1e1b24';
    ctx.fillRect(x, y + 10, width, 6);
    ctx.fillStyle = '#383442';
    ctx.fillRect(x, y + 11, width, 1);

    // Ferrure inférieure en fer forgé
    ctx.fillStyle = '#1e1b24';
    ctx.fillRect(x, y + 40, width, 6);
    ctx.fillStyle = '#383442';
    ctx.fillRect(x, y + 41, width, 1);

    // Rivets d'acier sur les ferrures
    ctx.fillStyle = '#6e697d';
    if (width > 6) {
      ctx.fillRect(x + 3, y + 12, 2, 2);
      ctx.fillRect(x + 3, y + 42, 2, 2);
    }
    if (width > 16) {
      ctx.fillRect(x + 12, y + 12, 2, 2);
      ctx.fillRect(x + 12, y + 42, 2, 2);
    }

    // Serrure centrale ouvragée avec crâne et trou de serrure doré
    if (progress === 0) {
      if (side === 'left') {
        // Moitié gauche de la serrure
        ctx.fillStyle = '#15131a';
        ctx.fillRect(x + width - 4, y + 23, 4, 12);
        ctx.fillStyle = '#363242';
        ctx.fillRect(x + width - 4, y + 24, 1, 10);
      } else {
        // Moitié droite de la serrure avec trou de serrure lumineux
        ctx.fillStyle = '#15131a';
        ctx.fillRect(x, y + 23, 5, 12);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x + 1, y + 27, 2, 2); // Tête du trou de serrure
        ctx.fillRect(x + 1, y + 29, 1, 3); // Fente
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 27, 1, 1); // Reflet magique
      }
    }
  }

  private static renderStoneArch(ctx: CanvasRenderingContext2D): void {
    // Montant gauche en pierre
    ctx.fillStyle = '#282630';
    ctx.fillRect(0, 0, 4, 64);
    ctx.fillStyle = '#413e4f';
    ctx.fillRect(0, 0, 1, 64);
    ctx.fillStyle = '#141318';
    ctx.fillRect(3, 0, 1, 64);

    // Montant droit en pierre
    ctx.fillStyle = '#282630';
    ctx.fillRect(60, 0, 4, 64);
    ctx.fillStyle = '#413e4f';
    ctx.fillRect(60, 0, 1, 64);
    ctx.fillStyle = '#141318';
    ctx.fillRect(63, 0, 1, 64);

    // Linteau supérieur en pierre taillée
    ctx.fillStyle = '#282630';
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillStyle = '#413e4f';
    ctx.fillRect(0, 0, 64, 1);
    ctx.fillStyle = '#141318';
    ctx.fillRect(0, 3, 64, 1);

    // Joints de mortier entre les blocs de pierre
    ctx.fillStyle = '#100f14';
    ctx.fillRect(0, 16, 4, 1);
    ctx.fillRect(0, 32, 4, 1);
    ctx.fillRect(0, 48, 4, 1);
    ctx.fillRect(60, 16, 4, 1);
    ctx.fillRect(60, 32, 4, 1);
    ctx.fillRect(60, 48, 4, 1);
    ctx.fillRect(16, 0, 1, 4);
    ctx.fillRect(32, 0, 1, 4);
    ctx.fillRect(48, 0, 1, 4);
  }
}
