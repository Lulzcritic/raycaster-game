import { COLORS, SCREEN_CONFIG, TEXTURE_CONFIG, TILE_TYPE } from '../config/constants';
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
    entities: readonly Entity[] = [],
    options?: { raidTimerSec?: number; isExtracted?: boolean }
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

    // 5. Dessin du sprite de la main du joueur au premier plan
    this.drawPlayerHand(player);

    // 6. Dessin de l'inventaire en losange en bas à gauche
    this.inventoryHud.render(this.ctx, player.inventory, this.textureManager);

    // 7. Dessin du réticule de visée fixe au centre de l'écran
    this.drawCrosshair();

    // 8. Interface de santé, zone et statut du joueur
    this.drawPlayerHUD(player, options?.raidTimerSec ?? 0);

    // 9. Effet de flash rouge d'impact de dégâts
    this.drawDamageFlash(player);

    // 10. Écran de victoire d'extraction si le joueur s'est extrait
    if (options?.isExtracted) {
      this.drawExtractionVictoryScreen(player, options.raidTimerSec ?? 0);
    }
  }

  private drawPlayerHand(player: Player): void {
    const sprite = this.textureManager.getTexture(TILE_TYPE.HAND_WAND);
    if (!sprite) {
      return;
    }

    const casting = player.isCasting();
    const drawWidth = sprite.width;
    const drawHeight = sprite.height;

    // Positionnée au premier plan en bas à droite, avec marge pour le balancement
    const baseX = Math.floor(this.canvas.width * 0.62 - drawWidth / 2);
    const baseY = this.canvas.height - drawHeight + 8;

    const castOffsetX = casting ? -4 : 0;
    const castOffsetY = casting ? -6 : 0;
    const x = Math.round(baseX + player.handBobX + castOffsetX);
    const y = Math.round(baseY + player.handBobY + castOffsetY);

    this.ctx.drawImage(sprite, x, y, drawWidth, drawHeight);
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

      // Dessin de la jauge de vie 3D au-dessus de l'entité (ennemi) si visible
      if (
        visibleCols > 2 &&
        typeof (item.entity as unknown as { getHealthBarInfo?: () => unknown })
          .getHealthBarInfo === 'function'
      ) {
        const hpInfo = (
          item.entity as unknown as {
            getHealthBarInfo: () => {
              percent: number;
              rank: 'normal' | 'elite' | 'boss';
              name: string;
              isVisible: boolean;
            } | null;
          }
        ).getHealthBarInfo();

        if (hpInfo?.isVisible) {
          this.drawEnemyHealthBar(screenX, drawStartY, spriteWidth, hpInfo);
        }
      }

      // Dessin de l'indicateur 3D au-dessus des portails d'extraction si visible
      if (
        visibleCols > 2 &&
        typeof (item.entity as unknown as { getExtractionInfo?: () => unknown })
          .getExtractionInfo === 'function'
      ) {
        const extInfo = (
          item.entity as unknown as {
            getExtractionInfo: () => {
              name: string;
              isActive: boolean;
              remainingSec: number;
            };
          }
        ).getExtractionInfo();

        this.drawExtractionLabel(screenX, drawStartY, extInfo);
      }
    }
  }

  private drawEnemyHealthBar(
    screenX: number,
    drawStartY: number,
    spriteWidth: number,
    hpInfo: { percent: number; rank: 'normal' | 'elite' | 'boss'; name: string }
  ): void {
    const isBoss = hpInfo.rank === 'boss';
    const isElite = hpInfo.rank === 'elite';

    const barWidth = Math.round(
      isBoss
        ? Math.max(56, Math.min(100, spriteWidth * 0.95))
        : isElite
          ? Math.max(38, Math.min(65, spriteWidth * 0.85))
          : Math.max(26, Math.min(46, spriteWidth * 0.75))
    );
    const barHeight = isBoss ? 6 : 4;
    const barX = Math.round(screenX - barWidth / 2);
    const barY = Math.round(drawStartY - (isBoss ? 16 : isElite ? 14 : 8));

    // Fond sombre
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    this.ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Bordure colorée selon le rang
    this.ctx.strokeStyle = isBoss
      ? '#f59e0b'
      : isElite
        ? '#c084fc'
        : '#475569';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);

    // Remplissage de la barre de vie
    const fillWidth = Math.round((barWidth - 2) * Math.max(0, Math.min(1, hpInfo.percent)));
    if (fillWidth > 0) {
      let fillColor = '#22c55e';
      if (hpInfo.percent < 0.25) {
        fillColor = '#ef4444';
      } else if (hpInfo.percent < 0.5) {
        fillColor = '#f59e0b';
      }
      if (isBoss) {
        fillColor = hpInfo.percent < 0.3 ? '#ef4444' : '#dc2626';
      } else if (isElite) {
        fillColor = hpInfo.percent < 0.3 ? '#ef4444' : '#a855f7';
      }

      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(barX + 1, barY, fillWidth, barHeight);
    }

    // Nom / titre au-dessus pour les monstres Élite et Boss
    if (isBoss || isElite) {
      this.ctx.font = 'bold 9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillStyle = isBoss ? '#fbbf24' : '#e9d5ff';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      this.ctx.shadowBlur = 3;
      const title = isBoss ? `👑 ${hpInfo.name}` : `★ ${hpInfo.name}`;
      this.ctx.fillText(title, screenX, barY - 2);
      this.ctx.shadowBlur = 0;
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

  private drawExtractionLabel(
    screenX: number,
    drawStartY: number,
    info: { name: string; isActive: boolean; remainingSec: number }
  ): void {
    const labelY = Math.round(drawStartY - 12);
    this.ctx.font = 'bold 9px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';

    if (info.isActive) {
      this.ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillText(`🌀 ${info.name.toUpperCase()} [OUVERT]`, screenX, labelY);
      this.ctx.shadowBlur = 0;
    } else {
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      this.ctx.shadowBlur = 3;
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(
        `⏳ ${info.name.toUpperCase()} (${info.remainingSec}s)`,
        screenX,
        labelY
      );
      this.ctx.shadowBlur = 0;
    }
  }

  private drawPlayerHUD(player: Player, raidTimerSec = 0): void {
    const x = 12;
    const y = 12;
    const barWidth = 120;
    const barHeight = 12;

    const hp = Math.max(0, player.health);
    const maxHp = player.maxHealth;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    // Panneau d'arrière-plan de la vie
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 20);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 3.5, y - 3.5, barWidth + 7, barHeight + 19);

    // Fond de la barre
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(x, y, barWidth, barHeight);

    // Remplissage de la barre de vie
    const fillW = Math.round(barWidth * ratio);
    if (fillW > 0) {
      const grad = this.ctx.createLinearGradient(x, y, x + barWidth, y);
      grad.addColorStop(0, '#dc2626');
      grad.addColorStop(1, '#ef4444');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(x, y, fillW, barHeight);
    }

    // Bordure de la jauge
    this.ctx.strokeStyle = '#991b1b';
    this.ctx.strokeRect(x - 0.5, y - 0.5, barWidth + 1, barHeight + 1);

    // Texte PV
    this.ctx.font = 'bold 9px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = '#f87171';
    this.ctx.fillText(`PV ${Math.ceil(hp)} / ${maxHp}`, x, y + barHeight + 4);

    // Indicateur de zone & chronomètre de raid au centre supérieur
    const distFromCenter = Math.hypot(player.x - 32, player.y - 32);
    let zoneTitle = 'ZONE 1 - QUARTIER DE DÉPART';
    let zoneColor = '#38bdf8';

    if (distFromCenter <= 7) {
      zoneTitle = 'ZONE 3 - SANCTUAIRE DU BOSS';
      zoneColor = '#ef4444';
    } else if (distFromCenter <= 19) {
      zoneTitle = 'ZONE 2 - ANNEAU CENTRAL (PARTAGÉE)';
      zoneColor = '#f59e0b';
    }

    const timerMin = Math.floor(raidTimerSec / 60);
    const timerSec = Math.floor(raidTimerSec % 60);
    const timeFormatted = `${timerMin.toString().padStart(2, '0')}:${timerSec.toString().padStart(2, '0')}`;

    const bannerW = 168;
    const bannerH = 20;
    const bannerX = Math.round((this.canvas.width - bannerW) / 2);
    const bannerY = 8;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.strokeRect(bannerX + 0.5, bannerY + 0.5, bannerW - 1, bannerH - 1);

    this.ctx.font = 'bold 8px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = zoneColor;
    this.ctx.fillText(zoneTitle, bannerX + bannerW / 2, bannerY + 3);

    this.ctx.font = '7px monospace';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(`⏱️ RAID ${timeFormatted}`, bannerX + bannerW / 2, bannerY + 11);

    // Écran de mort si le joueur est tombé au combat
    if (!player.isAlive()) {
      this.ctx.fillStyle = 'rgba(20, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = 'bold 24px monospace';
      this.ctx.fillStyle = '#ef4444';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(
        'VOUS ÊTES MORT',
        this.canvas.width / 2,
        this.canvas.height / 2 - 10
      );

      this.ctx.font = '12px monospace';
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.fillText(
        'La gélatine sombre vous a terrassé...',
        this.canvas.width / 2,
        this.canvas.height / 2 + 16
      );

      this.ctx.font = 'bold 11px monospace';
      this.ctx.fillStyle = '#facc15';
      this.ctx.fillText(
        'Appuyez sur [R] pour réapparaître',
        this.canvas.width / 2,
        this.canvas.height / 2 + 36
      );
      this.ctx.shadowBlur = 0;
    }
  }

  private drawExtractionVictoryScreen(player: Player, raidTimerSec: number): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.fillStyle = 'rgba(8, 15, 30, 0.92)';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(8, 8, width - 16, height - 16);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(10, 10, width - 20, height - 20);

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    this.ctx.font = 'bold 15px monospace';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText('👑 EXTRACTION RÉUSSIE ! 👑', width / 2, 16);
    this.ctx.shadowBlur = 0;

    this.ctx.font = '9px monospace';
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.fillText('Vous avez survécu et sécurisé votre butin.', width / 2, 34);

    const timerMin = Math.floor(raidTimerSec / 60);
    const timerSec = Math.floor(raidTimerSec % 60);
    const timeFormatted = `${timerMin.toString().padStart(2, '0')}:${timerSec.toString().padStart(2, '0')}`;
    this.ctx.font = 'bold 8px monospace';
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.fillText(
      `⏱️ Temps : ${timeFormatted}   |   ❤️ PV restants : ${Math.ceil(player.health)}/${player.maxHealth}`,
      width / 2,
      48
    );

    this.ctx.font = 'bold 8px monospace';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText('--- BUTIN EXTRAIT DU DONJON ---', width / 2, 64);

    const slots: Array<'weapon' | 'armor' | 'hat' | 'boots' | 'key'> = [
      'weapon',
      'armor',
      'hat',
      'boots',
      'key',
    ];
    let startY = 76;
    let count = 0;
    for (const slot of slots) {
      const item = player.inventory.getItem(slot);
      if (item) {
        count++;
        let rarityColor = '#ffffff';
        if (item.rarity === 'uncommon') rarityColor = '#22c55e';
        else if (item.rarity === 'rare') rarityColor = '#3b82f6';
        else if (item.rarity === 'epic') rarityColor = '#a855f7';
        else if (item.rarity === 'legendary') rarityColor = '#f97316';
        else if (item.rarity === 'artifact') rarityColor = '#eab308';

        this.ctx.font = 'bold 8px monospace';
        this.ctx.fillStyle = rarityColor;
        this.ctx.fillText(`[${item.slot.toUpperCase()}] ${item.name}`, width / 2, startY);
        startY += 11;
      }
    }

    if (count === 0) {
      this.ctx.font = 'italic 8px monospace';
      this.ctx.fillStyle = '#64748b';
      this.ctx.fillText('(Aucun équipement emporté)', width / 2, startY);
      startY += 12;
    }

    this.ctx.font = 'bold 10px monospace';
    this.ctx.fillStyle = '#22c55e';
    this.ctx.shadowColor = 'rgba(34, 197, 94, 0.7)';
    this.ctx.shadowBlur = 4;
    this.ctx.fillText(
      'Appuyez sur [R] pour LANCER UNE NOUVELLE EXPÉDITION',
      width / 2,
      height - 24
    );
    this.ctx.shadowBlur = 0;
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
