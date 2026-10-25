import { COLORS, SCREEN_CONFIG, TEXTURE_CONFIG } from '../config/constants';
import type { Entity } from '../entities/Entity';
import { FrostingPuddle } from '../entities/FrostingPuddle';
import type { Player } from '../entities/Player';
import type { RayHit } from '../types';
import type { GameMap } from '../world/GameMap';
import { InventoryHUD } from '../ui/InventoryHUD';
import { Raycaster } from './Raycaster';
import type { TextureManager } from './TextureManager';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly uiCanvas: HTMLCanvasElement | null;
  private readonly uiCtx: CanvasRenderingContext2D | null;
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

  // Couleurs 32-bit et grille d'accélération spatiale pour les traces de glaçage au sol
  private readonly frostingWhite32: number;
  private readonly frostingCream32: number;
  private readonly frostingOrange32: number;
  private readonly frostingDarkOrange32: number;
  private readonly frostingSprinkles32: number[];
  private puddleGrid: (FrostingPuddle[] | null)[] = [];
  private readonly touchedPuddleCells: number[] = [];

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

    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement | null;
    if (this.uiCanvas) {
      this.uiCanvas.width = SCREEN_CONFIG.WIDTH;
      this.uiCanvas.height = SCREEN_CONFIG.HEIGHT;
      this.uiCtx = this.uiCanvas.getContext('2d');
      if (this.uiCtx) {
        this.uiCtx.imageSmoothingEnabled = false;
      }
    } else {
      this.uiCtx = null;
    }

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

    this.frostingWhite32 = this.colorToUint32('#ffffff');
    this.frostingCream32 = this.colorToUint32('#fff7ed');
    this.frostingOrange32 = this.colorToUint32('#f97316');
    this.frostingDarkOrange32 = this.colorToUint32('#ea580c');
    this.frostingSprinkles32 = [
      this.colorToUint32('#ec4899'),
      this.colorToUint32('#3b82f6'),
      this.colorToUint32('#10b981'),
      this.colorToUint32('#facc15'),
    ];
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

    // Détection des flaques de glaçage au sol à projeter à plat sur la texture du sol
    const activePuddles: FrostingPuddle[] = [];
    for (let e = 0; e < entities.length; e++) {
      const ent = entities[e];
      if (ent instanceof FrostingPuddle && ent.active) {
        activePuddles.push(ent);
      }
    }
    const hasPuddles = activePuddles.length > 0;

    if (hasPuddles) {
      const requiredSize = map.width * map.height;
      if (this.puddleGrid.length < requiredSize) {
        this.puddleGrid = new Array(requiredSize).fill(null);
      }
      for (let p = 0; p < activePuddles.length; p++) {
        const puddle = activePuddles[p];
        const minCX = Math.max(0, Math.floor(puddle.x - puddle.radius));
        const maxCX = Math.min(map.width - 1, Math.floor(puddle.x + puddle.radius));
        const minCY = Math.max(0, Math.floor(puddle.y - puddle.radius));
        const maxCY = Math.min(map.height - 1, Math.floor(puddle.y + puddle.radius));

        for (let cy = minCY; cy <= maxCY; cy++) {
          const rowOffset = cy * map.width;
          for (let cx = minCX; cx <= maxCX; cx++) {
            const cellIdx = rowOffset + cx;
            let list = this.puddleGrid[cellIdx];
            if (!list) {
              list = [];
              this.puddleGrid[cellIdx] = list;
              this.touchedPuddleCells.push(cellIdx);
            }
            list.push(puddle);
          }
        }
      }
    }

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

        let pixelColor = texPixels
          ? texPixels[Math.floor((floorY - Math.floor(floorY)) * texSize) * texSize + Math.floor((floorX - Math.floor(floorX)) * texSize)]
          : this.floorFallbackColor32;

        // Application à plat du glaçage par-dessus la texture du sol
        if (hasPuddles) {
          const cellX = Math.floor(floorX);
          const cellY = Math.floor(floorY);
          if (cellX >= 0 && cellX < map.width && cellY >= 0 && cellY < map.height) {
            const puddlesInCell = this.puddleGrid[cellY * map.width + cellX];
            if (puddlesInCell) {
              pixelColor = this.applyFrostingColor(floorX, floorY, puddlesInCell, pixelColor);
            }
          }
        }

        this.screenBuffer32[y * width + i] = pixelColor;
      }
    }

    if (this.touchedPuddleCells.length > 0) {
      for (let t = 0; t < this.touchedPuddleCells.length; t++) {
        this.puddleGrid[this.touchedPuddleCells[t]] = null;
      }
      this.touchedPuddleCells.length = 0;
    }

    // 2. Affichage de la Skybox et du sol texturé sur le canvas
    this.ctx.putImageData(this.screenImageData, 0, 0);

    // 3. Dessin des tranches verticales des murs par-dessus
    for (let i = 0; i < width; i += 1) {
      this.drawWallSlice(i, this.rayHits[i]);
    }

    // 4. Dessin des entités et projectiles 3D (triés par distance + Z-buffer)
    this.drawSprites(player, entities);

    // 5. Dessin de l'inventaire en losange en bas à gauche (au-dessus des mains sur le calque UI)
    const targetUiCtx = this.uiCtx ?? this.ctx;
    if (this.uiCtx) {
      this.uiCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.inventoryHud.render(targetUiCtx, player.inventory, this.textureManager);

    // 6. Dessin du réticule de visée fixe au centre de l'écran
    this.drawCrosshair(targetUiCtx);

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

  private drawCrosshair(targetCtx: CanvasRenderingContext2D = this.ctx): void {
    const centerX = Math.floor(this.canvas.width / 2);
    const centerY = Math.floor(this.canvas.height / 2);
    const gap = 2;
    const armLength = 3;

    // Contour sombre pour la lisibilité sur tous les fonds
    targetCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    targetCtx.fillRect(centerX - gap - armLength - 1, centerY - 1, armLength + 2, 3);
    targetCtx.fillRect(centerX + gap, centerY - 1, armLength + 2, 3);
    targetCtx.fillRect(centerX - 1, centerY - gap - armLength - 1, 3, armLength + 2);
    targetCtx.fillRect(centerX - 1, centerY + gap, 3, armLength + 2);

    // Branches blanches pixel-art du viseur
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(centerX - gap - armLength, centerY, armLength, 1); // Gauche
    targetCtx.fillRect(centerX + gap + 1, centerY, armLength, 1);         // Droite
    targetCtx.fillRect(centerX, centerY - gap - armLength, 1, armLength); // Haut
    targetCtx.fillRect(centerX, centerY + gap + 1, 1, armLength);         // Bas
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

  /**
   * Projette le glaçage crémeux à plat par-dessus la texture du sol avec coulis d'orange et vermicelles
   */
  private applyFrostingColor(
    floorX: number,
    floorY: number,
    puddles: FrostingPuddle[],
    basePixel: number
  ): number {
    let resultColor = basePixel;

    for (let p = 0; p < puddles.length; p++) {
      const puddle = puddles[p];
      const dx = floorX - puddle.x;
      const dy = floorY - puddle.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > puddle.radiusSq) {
        continue;
      }

      const normDist = Math.sqrt(distSq) / puddle.radius;
      // Ondulations organiques sur les contours de la trace de glaçage
      const angle = Math.atan2(dy, dx);
      const wobble =
        Math.sin(angle * 5 + puddle.variant * 2) * 0.08 +
        Math.cos(angle * 7) * 0.05;
      const effectiveDist = normDist + wobble;

      if (effectiveDist > 1.0) {
        continue;
      }

      // Fondu en fin de vie durant les 1.5 dernières secondes
      const lifeFade =
        puddle.remainingLife < 1.5
          ? Math.max(0, puddle.remainingLife / 1.5)
          : 1.0;

      // Dessin du motif de glaçage : coulis d'orange carotte et vermicelles de sucre
      const swirl = Math.sin(dx * 18 + dy * 14 + puddle.variant * 2.3);
      let frostingColor: number;

      if (Math.abs(swirl) > 0.72) {
        frostingColor = swirl > 0 ? this.frostingOrange32 : this.frostingDarkOrange32;
      } else {
        const sprinkleHash =
          ((Math.sin(floorX * 47.1 + floorY * 73.9) * 43758.5453) % 1 + 1) % 1;
        if (sprinkleHash > 0.94) {
          const sprinkleIdx = Math.floor(sprinkleHash * 100) % this.frostingSprinkles32.length;
          frostingColor = this.frostingSprinkles32[sprinkleIdx];
        } else if (effectiveDist < 0.35) {
          frostingColor = this.frostingWhite32;
        } else {
          frostingColor = this.frostingCream32;
        }
      }

      let alpha = lifeFade;
      if (effectiveDist > 0.78) {
        alpha *= (1.0 - effectiveDist) / 0.22;
      }

      if (alpha >= 0.96) {
        resultColor = frostingColor;
      } else if (alpha > 0.04) {
        resultColor = this.blendPixels(resultColor, frostingColor, alpha);
      }
    }

    return resultColor;
  }

  private blendPixels(base: number, overlay: number, alpha: number): number {
    const invAlpha = 1 - alpha;
    const r = Math.round((base & 0xff) * invAlpha + (overlay & 0xff) * alpha);
    const g = Math.round(((base >> 8) & 0xff) * invAlpha + ((overlay >> 8) & 0xff) * alpha);
    const b = Math.round(((base >> 16) & 0xff) * invAlpha + ((overlay >> 16) & 0xff) * alpha);
    return (0xff << 24) | (b << 16) | (g << 8) | r;
  }
}
