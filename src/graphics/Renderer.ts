import { COLORS, SCREEN_CONFIG, TEXTURE_CONFIG } from '../config/constants';
import type { Entity } from '../entities/Entity';
import type { Player } from '../entities/Player';
import type { RayHit } from '../types';
import type { GameMap } from '../world/GameMap';
import { InventoryHUD } from '../ui/InventoryHUD';
import { Raycaster } from './Raycaster';
import type { TextureManager } from './TextureManager';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly raycaster: Raycaster;
  private readonly textureManager: TextureManager;
  private readonly inventoryHud = new InventoryHUD();

  // Buffers pour le rendu rapide de la Skybox et du sol pixel par pixel
  private readonly screenImageData: ImageData;
  private readonly screenBuffer32: Uint32Array;
  private readonly rowDistances: Float64Array;
  private readonly rayHits: RayHit[];
  private readonly ceilingColor32: number;
  private readonly floorFallbackColor32: number;
  private focalLength: number;
  private lastFov = 0;

  constructor(canvas: HTMLCanvasElement, textureManager: TextureManager) {
    this.canvas = canvas;
    this.canvas.width = SCREEN_CONFIG.WIDTH;
    this.canvas.height = SCREEN_CONFIG.HEIGHT;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error("Impossible d'initialiser le contexte 2D du canvas.");
    }
    this.ctx = context;
    // Désactive le lissage pour garder un rendu pixel-art net sur les textures
    this.ctx.imageSmoothingEnabled = false;

    this.raycaster = new Raycaster();
    this.textureManager = textureManager;

    this.screenImageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.screenBuffer32 = new Uint32Array(this.screenImageData.data.buffer);
    this.rayHits = new Array<RayHit>(this.canvas.width);

    // Initialisation des distances de projection
    const halfHeight = this.canvas.height / 2;
    this.focalLength = this.canvas.height;
    this.rowDistances = new Float64Array(this.canvas.height);
    for (let y = Math.floor(halfHeight) + 1; y < this.canvas.height; y++) {
      this.rowDistances[y] = halfHeight / (y - halfHeight);
    }

    this.ceilingColor32 = this.colorToUint32(COLORS.CEILING);
    this.floorFallbackColor32 = this.colorToUint32(COLORS.FLOOR);
  }

  public getRayHits(): readonly RayHit[] {
    return this.rayHits;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getFocalLength(): number {
    return this.focalLength;
  }

  public render(
    player: Player,
    map: GameMap,
    entities: readonly Entity[] = []
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const halfHeight = Math.floor(height / 2);

    // Mise à jour de la distance focale et des tables de projection du sol selon le FOV actuel
    if (player.fov !== this.lastFov) {
      this.lastFov = player.fov;
      this.focalLength = (width / 2) / Math.tan(player.fov / 2);
      const focalHalf = this.focalLength / 2;
      for (let y = halfHeight + 1; y < height; y++) {
        this.rowDistances[y] = focalHalf / (y - halfHeight);
      }
    }

    const startRayAngle = player.angle - player.fov / 2;
    const texSize = this.textureManager.textureSize;
    const skyWidth = this.textureManager.skyboxWidth;
    const skyHeight = this.textureManager.skyboxHeight;
    const skyPixels = this.textureManager.getTexturePixels(map.skyTileId);
    const skyPeriod = skyWidth * 2;

    // 1. Lancer de rayons, projection de la Skybox (1:1 sans étirement) et du sol
    for (let i = 0; i < width; i += 1) {
      const rayAngle = startRayAngle + (i / width) * player.fov;
      const rayResult = this.raycaster.castRay(player, map, rayAngle);
      this.rayHits[i] = rayResult;

      const wallHeight = rayResult.hit ? this.focalLength / rayResult.distance : 0;
      const drawStart = (height - wallHeight) / 2;
      const drawEnd = (height + wallHeight) / 2;

      // --- Rendu de la Skybox ---
      const skyEnd = Math.min(halfHeight, Math.max(0, Math.ceil(drawStart)));

      if (skyPixels) {
        const angleInPixels = Math.floor((rayAngle / player.fov) * skyWidth);
        const wrapped = ((angleInPixels % skyPeriod) + skyPeriod) % skyPeriod;
        const skyX = wrapped < skyWidth ? wrapped : skyPeriod - 1 - wrapped;

        for (let y = 0; y < skyEnd; y += 1) {
          const skyY = Math.floor((y / halfHeight) * skyHeight);
          this.screenBuffer32[y * width + i] = skyPixels[skyY * skyWidth + skyX];
        }
      } else {
        for (let y = 0; y < skyEnd; y += 1) {
          this.screenBuffer32[y * width + i] = this.ceilingColor32;
        }
      }

      // --- Rendu du sol (uniquement en dessous du bas du mur) ---
      if (drawEnd <= halfHeight) {
        this.screenBuffer32[halfHeight * width + i] = this.floorFallbackColor32;
      }

      const floorStart = Math.max(halfHeight + 1, Math.floor(drawEnd));

      for (let y = floorStart; y < height; y += 1) {
        const distance = this.rowDistances[y];

        // Coordonnées monde (X, Y) du point du sol projeté sur le pixel (i, y)
        const floorX = player.x + distance * rayResult.vectorX;
        const floorY = player.y + distance * rayResult.vectorY;

        const floorTileId = map.getFloorTile(floorX, floorY);
        const texPixels = this.textureManager.getTexturePixels(floorTileId);

        if (texPixels) {
          const texX = Math.floor((floorX - Math.floor(floorX)) * texSize);
          const texY = Math.floor((floorY - Math.floor(floorY)) * texSize);
          this.screenBuffer32[y * width + i] = texPixels[texY * texSize + texX];
        } else {
          this.screenBuffer32[y * width + i] = this.floorFallbackColor32;
        }
      }
    }

    // 2. Affichage de la Skybox et du sol texturé sur le canvas
    this.ctx.putImageData(this.screenImageData, 0, 0);

    // 3. Dessin des tranches verticales des murs par-dessus
    for (let i = 0; i < width; i += 1) {
      this.drawWallSlice(i, this.rayHits[i]);
    }

    // 4. Dessin des entités et projectiles 3D (triés par distance + Z-buffer)
    this.drawSprites(player, entities);

    // 5. Dessin de l'inventaire en losange en bas à gauche
    this.inventoryHud.render(this.ctx, player.inventory, this.textureManager);

    // 6. Dessin du réticule de visée fixe au centre de l'écran
    this.drawCrosshair();

    // 7. Effet de flash rouge d'impact de dégâts
    this.drawDamageFlash(player);
  }

  private drawSprites(player: Player, entities: readonly Entity[]): void {
    const visibleSprites: Array<{
      entity: Entity;
      sprite: HTMLCanvasElement;
      distance: number;
      angleDiff: number;
    }> = [];

    for (const entity of entities) {
      if (!entity.active) {
        continue;
      }
      const sprite = entity.getSprite();
      if (!sprite) {
        continue;
      }

      const dx = entity.x - player.x;
      const dy = entity.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.08) {
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      // On garde uniquement les sprites présents dans le cône de vision élargi
      if (Math.abs(angleDiff) <= player.fov) {
        visibleSprites.push({ entity, sprite, distance, angleDiff });
      }
    }

    // Tri du plus éloigné au plus proche (avec départage par élévation pour les entités superposées)
    visibleSprites.sort((a, b) => {
      if (Math.abs(b.distance - a.distance) > 0.001) {
        return b.distance - a.distance;
      }
      return a.entity.getElevation() - b.entity.getElevation();
    });

    const width = this.canvas.width;
    const height = this.canvas.height;

    for (const item of visibleSprites) {
      const fullWallHeight = this.focalLength / item.distance;
      const spriteHeight = fullWallHeight * item.entity.getScale();
      const aspectRatio = item.sprite.width / item.sprite.height;
      const spriteWidth = spriteHeight * aspectRatio;
      const screenX = (0.5 + item.angleDiff / player.fov) * width;

      const drawStartX = Math.floor(screenX - spriteWidth / 2);
      const drawEndX = Math.floor(screenX + spriteWidth / 2);

      // Projection exacte du point (entity.x, entity.y) sur le sol avec prise en compte de l'élévation
      const floorScreenY = (height + fullWallHeight) / 2;
      const elevation = item.entity.getElevation();
      const bottomScreenY = floorScreenY - fullWallHeight * elevation;
      const drawStartY = item.entity.isFloorAnchored()
        ? Math.floor(bottomScreenY - spriteHeight)
        : Math.floor((height - spriteHeight) / 2);

      const startStripe = Math.max(0, drawStartX);
      const endStripe = Math.min(width - 1, drawEndX);
      const shadowHeight = Math.max(2, Math.floor(spriteWidth * 0.14));

      let visibleCols = 0;
      for (let stripe = startStripe; stripe <= endStripe; stripe++) {
        const wallHit = this.rayHits[stripe];
        // Z-Buffer : la colonne du sprite n'est dessinée que si elle est devant le mur
        if (!wallHit.hit || item.distance < wallHit.distance) {
          visibleCols += 1;
          // Ombre portée au sol sous le coffre / objet posé au sol ou en vol
          if (item.entity.isFloorAnchored()) {
            const normX = (stripe - drawStartX) / spriteWidth - 0.5;
            if (Math.abs(normX) <= 0.46) {
              const ellipseFactor = Math.sqrt(Math.max(0, 1 - (normX / 0.46) ** 2));
              const shadowScale = Math.max(0.45, 1 - elevation * 0.7);
              const colShadowH = Math.max(
                1,
                Math.round(shadowHeight * ellipseFactor * shadowScale)
              );
              this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
              this.ctx.fillRect(
                stripe,
                Math.floor(floorScreenY - colShadowH * 0.6),
                1,
                colShadowH
              );
            }
          }

          const texX = Math.min(
            item.sprite.width - 1,
            Math.max(
              0,
              Math.floor(((stripe - drawStartX) / spriteWidth) * item.sprite.width)
            )
          );

          this.ctx.drawImage(
            item.sprite,
            texX,
            0,
            1,
            item.sprite.height,
            stripe,
            drawStartY,
            1,
            spriteHeight
          );
        }
      }
    }
  }

  private drawDamageFlash(player: Player): void {
    if (player.damageFlashTimer <= 0) {
      return;
    }
    const alpha = Math.min(0.65, player.damageFlashTimer * 1.8);
    this.ctx.fillStyle = `rgba(180, 10, 10, ${alpha})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawCrosshair(): void {
    const centerX = Math.floor(this.canvas.width / 2);
    const centerY = Math.floor(this.canvas.height / 2);
    const gap = 2;
    const armLength = 3;

    // Contour sombre pour la lisibilité sur tous les fonds
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.fillRect(centerX - gap - armLength - 1, centerY - 1, armLength + 2, 3);
    this.ctx.fillRect(centerX + gap, centerY - 1, armLength + 2, 3);
    this.ctx.fillRect(centerX - 1, centerY - gap - armLength - 1, 3, armLength + 2);
    this.ctx.fillRect(centerX - 1, centerY + gap, 3, armLength + 2);

    // Branches blanches pixel-art du viseur
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(centerX - gap - armLength, centerY, armLength, 1); // Gauche
    this.ctx.fillRect(centerX + gap + 1, centerY, armLength, 1);         // Droite
    this.ctx.fillRect(centerX, centerY - gap - armLength, 1, armLength); // Haut
    this.ctx.fillRect(centerX, centerY + gap + 1, 1, armLength);         // Bas
  }

  private drawWallSlice(column: number, rayResult: RayHit): void {
    if (!rayResult.hit) {
      return;
    }

    const wallHeight = this.focalLength / rayResult.distance;
    const drawStart = (this.canvas.height - wallHeight) / 2;
    const texture = this.textureManager.getTexture(rayResult.tileId);

    if (texture) {
      // Calcul de la colonne X à prélever dans la texture
      let texX = Math.floor(rayResult.wallX * texture.width);

      // Inversion selon l'orientation du rayon pour éviter l'effet miroir
      if (rayResult.side === 0 && rayResult.vectorX < 0) {
        texX = texture.width - texX - 1;
      }
      if (rayResult.side === 1 && rayResult.vectorY > 0) {
        texX = texture.width - texX - 1;
      }

      // Dessin de la tranche verticale de 1px de la texture
      this.ctx.drawImage(
        texture,
        texX,
        0,
        1,
        texture.height,
        column,
        drawStart,
        1,
        wallHeight
      );

      // Assombrissement des faces horizontales pour conserver le relief 3D
      if (rayResult.side === 1) {
        this.ctx.fillStyle = TEXTURE_CONFIG.HORIZONTAL_SHADING;
        this.ctx.fillRect(column, drawStart, 1, wallHeight);
      }
    } else {
      // Fallback en couleur unie si aucune texture n'est trouvée pour ce tileId
      this.ctx.fillStyle =
        rayResult.side === 0 ? COLORS.WALL_VERTICAL : COLORS.WALL_HORIZONTAL;
      this.ctx.fillRect(column, drawStart, 1, wallHeight);
    }
  }

  private colorToUint32(color: string): number {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, 1, 1);
    const data = new Uint32Array(tempCtx.getImageData(0, 0, 1, 1).data.buffer);
    return data[0];
  }
}
