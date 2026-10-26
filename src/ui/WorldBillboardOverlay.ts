import type { Entity } from '../entities/Entity';
import { BillboardSprite } from '../entities/BillboardSprite';
import { Door } from '../entities/Door';
import { DroppedItemOrb } from '../entities/DroppedItemOrb';
import { Enemy } from '../entities/Enemy';
import { ExtractionPortal } from '../entities/ExtractionPortal';
import { Merchant } from '../entities/Merchant';
import { RemotePlayer } from '../entities/RemotePlayer';
import { createItemCardElement, fillItemCardElement } from './ItemTooltip';
import { TILE_TYPE } from '../config/constants';
import type { Player } from '../entities/Player';
import type { Renderer } from '../graphics/Renderer';
import type { EquipmentItem } from '../types';

/**
 * Gestionnaire d'affichage haute résolution dans le monde 3D :
 * - Fiches d'objets flottant au-dessus des orbes et billboards d'objets
 * - Barres de vie et noms au-dessus des monstres (Blobs, Élites, Boss)
 * - Indicateurs d'état et chronos au-dessus des portails d'extraction
 * - Radar de détection des coffres à travers les murs par l'Homonculus
 *
 * Le rendu est effectué en HTML/DOM haute résolution (typographie nette non-pixelisée).
 */
export class WorldBillboardOverlay {
  private readonly container: HTMLElement | null;
  private readonly cardMap = new Map<Entity, HTMLElement>();
  private readonly enemyMap = new Map<Enemy, HTMLElement>();
  private readonly portalMap = new Map<ExtractionPortal, HTMLElement>();
  private readonly chestBeaconMap = new Map<BillboardSprite, HTMLElement>();
  private readonly merchantMap = new Map<Merchant, HTMLElement>();
  private readonly doorMap = new Map<Door, HTMLElement>();
  private readonly remotePlayerMap = new Map<RemotePlayer, HTMLElement>();
  private edgeBeaconEl: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('world-billboards');
  }

  public update(
    entities: readonly Entity[],
    player: Player,
    renderer: Renderer
  ): void {
    if (!this.container) {
      return;
    }

    const canvas = renderer.getCanvas();
    const rayHits = renderer.getRayHits();
    const canvasRect = canvas.getBoundingClientRect();
    const focalLength = renderer.getFocalLength();

    // =========================================================================
    // 1. FICHES D'OBJETS AU SOL (ORBES ET BILLBOARDS D'OBJETS)
    // =========================================================================
    const activeHolders = new Map<Entity, EquipmentItem>();
    for (const entity of entities) {
      if (!entity.active) continue;
      if (entity instanceof DroppedItemOrb) {
        activeHolders.set(entity, entity.item);
      } else if (
        entity instanceof BillboardSprite &&
        entity.textureId === TILE_TYPE.HOMONCULUS
      ) {
        const item = entity.getInspectedItem();
        if (item) {
          activeHolders.set(entity, item);
        }
      }
    }

    for (const [holder, cardEl] of this.cardMap.entries()) {
      if (!activeHolders.has(holder)) {
        cardEl.remove();
        this.cardMap.delete(holder);
      }
    }

    for (const [holder, item] of activeHolders.entries()) {
      let cardEl = this.cardMap.get(holder);
      const equippedItem = player.inventory.getItem(item.slot);
      const itemKey = item.instanceId ?? item.id;
      const equippedKey = equippedItem
        ? (equippedItem.instanceId ?? equippedItem.id)
        : 'empty';

      if (!cardEl) {
        cardEl = this.createCardElement(item, equippedItem);
        cardEl.dataset.itemKey = itemKey;
        cardEl.dataset.equippedKey = equippedKey;
        this.container.appendChild(cardEl);
        this.cardMap.set(holder, cardEl);
      } else if (
        cardEl.dataset.itemKey !== itemKey ||
        cardEl.dataset.equippedKey !== equippedKey
      ) {
        fillItemCardElement(cardEl, item, equippedItem);
        cardEl.dataset.itemKey = itemKey;
        cardEl.dataset.equippedKey = equippedKey;
      }

      if (holder instanceof DroppedItemOrb && !holder.hasLanded()) {
        cardEl.style.display = 'none';
        continue;
      }

      const dx = holder.x - player.x;
      const dy = holder.y - player.y;
      const distance = Math.hypot(dx, dy);

      const MAX_CARD_DISTANCE = 2.4;
      const FADE_START_DISTANCE = 1.7;

      if (distance < 0.1 || distance > MAX_CARD_DISTANCE) {
        cardEl.style.display = 'none';
        continue;
      }

      let opacity = 1;
      if (distance > FADE_START_DISTANCE) {
        opacity = Math.max(
          0,
          (MAX_CARD_DISTANCE - distance) / (MAX_CARD_DISTANCE - FADE_START_DISTANCE)
        );
      }
      cardEl.style.opacity = opacity.toFixed(2);

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.12) {
        cardEl.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.08) {
          cardEl.style.display = 'none';
          continue;
        }
      }

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const bottomScreenY = floorScreenY - fullWallHeight * holder.getElevation();
      const topOfOrbScreenY = bottomScreenY - fullWallHeight * holder.getScale();
      const floatGap = 10;
      let anchorCanvasY = topOfOrbScreenY - floatGap;
      anchorCanvasY = Math.min(anchorCanvasY, 204);

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      const scale = Math.max(0.48, Math.min(1.4, 1.15 / distance));

      cardEl.style.display = 'flex';
      cardEl.style.left = `${screenPixelX}px`;
      cardEl.style.top = `${screenPixelY}px`;
      cardEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }

    // =========================================================================
    // 2. BARRES DE VIE ET NOMS AU-DESSUS DES ENNEMIS (MOBS)
    // =========================================================================
    const activeEnemies = new Set<Enemy>();
    for (const entity of entities) {
      if (entity instanceof Enemy && entity.active && entity.isAlive()) {
        activeEnemies.add(entity);
      }
    }

    for (const [enemy, enemyEl] of this.enemyMap.entries()) {
      if (!activeEnemies.has(enemy)) {
        enemyEl.remove();
        this.enemyMap.delete(enemy);
      }
    }

    for (const enemy of activeEnemies) {
      const hpInfo = enemy.getHealthBarInfo();
      let enemyEl = this.enemyMap.get(enemy);

      if (!hpInfo.isVisible) {
        if (enemyEl) enemyEl.style.display = 'none';
        continue;
      }

      if (!enemyEl) {
        enemyEl = this.createEnemyElement(enemy, hpInfo);
        this.container.appendChild(enemyEl);
        this.enemyMap.set(enemy, enemyEl);
      }

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.2 || distance > 8.5) {
        enemyEl.style.display = 'none';
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.1) {
        enemyEl.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Z-buffer occlusion
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.12) {
          enemyEl.style.display = 'none';
          continue;
        }
      }

      // Mise à jour du pourcentage et de la couleur de la barre de vie
      this.updateEnemyElement(enemyEl, hpInfo);

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const bottomScreenY = floorScreenY - fullWallHeight * enemy.getElevation();
      const topOfSpriteScreenY = bottomScreenY - fullWallHeight * enemy.getScale();
      const offsetAbove = hpInfo.rank === 'boss' ? 22 : hpInfo.rank === 'elite' ? 18 : 14;
      const anchorCanvasY = topOfSpriteScreenY - offsetAbove;

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      // Échelle Deadlock : barres plus imposantes et très lisibles à moyenne portée
      const scale = Math.max(0.75, Math.min(1.35, 1.55 / Math.sqrt(distance)));

      enemyEl.style.display = 'flex';
      enemyEl.style.left = `${screenPixelX}px`;
      enemyEl.style.top = `${screenPixelY}px`;
      enemyEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }

    // =========================================================================
    // 3. INDICATEURS D'ÉTAT AU-DESSUS DES PORTAILS D'EXTRACTION
    // =========================================================================
    const activePortals = new Set<ExtractionPortal>();
    for (const entity of entities) {
      if (entity instanceof ExtractionPortal && entity.active) {
        activePortals.add(entity);
      }
    }

    for (const [portal, portalEl] of this.portalMap.entries()) {
      if (!activePortals.has(portal)) {
        portalEl.remove();
        this.portalMap.delete(portal);
      }
    }

    for (const portal of activePortals) {
      const extInfo = portal.getExtractionInfo();
      let portalEl = this.portalMap.get(portal);

      if (!portalEl) {
        portalEl = this.createPortalElement();
        this.container.appendChild(portalEl);
        this.portalMap.set(portal, portalEl);
      }

      const dx = portal.x - player.x;
      const dy = portal.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.3 || distance > 12.0) {
        portalEl.style.display = 'none';
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.1) {
        portalEl.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Z-buffer occlusion
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.14) {
          portalEl.style.display = 'none';
          continue;
        }
      }

      // Mise à jour de l'affichage du portail
      this.updatePortalElement(portalEl, extInfo);

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const topOfSpriteScreenY = floorScreenY - fullWallHeight * portal.getScale();
      const anchorCanvasY = topOfSpriteScreenY - 12;

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      const scale = Math.max(0.7, Math.min(1.2, 1.4 / Math.sqrt(distance)));

      portalEl.style.display = 'flex';
      portalEl.style.left = `${screenPixelX}px`;
      portalEl.style.top = `${screenPixelY}px`;
      portalEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }

    // =========================================================================
    // 4. DÉTECTION DES COFFRES PAR L'HOMONCULUS (VISION À TRAVERS LES MURS)
    // =========================================================================
    const hasHomonculus =
      player.inventory.getItem('offhand')?.id === 'offhand_homonculus';

    if (!hasHomonculus) {
      if (this.chestBeaconMap.size > 0) {
        for (const el of this.chestBeaconMap.values()) {
          el.remove();
        }
        this.chestBeaconMap.clear();
      }
      if (this.edgeBeaconEl) {
        this.edgeBeaconEl.style.display = 'none';
      }
    } else {
      // Collecte de tous les coffres non-ouverts actifs
      const unopenedChests: BillboardSprite[] = [];
      for (const entity of entities) {
        if (
          entity instanceof BillboardSprite &&
          entity.active &&
          entity.textureId === TILE_TYPE.CHEST &&
          !entity.isChestOpened()
        ) {
          unopenedChests.push(entity);
        }
      }

      const detected = unopenedChests
        .map((chest) => {
          const dx = chest.x - player.x;
          const dy = chest.y - player.y;
          const dist = Math.hypot(dx, dy);
          return { chest, dx, dy, dist };
        })
        .sort((a, b) => a.dist - b.dist);

      const MAX_RADAR_DIST = 26;
      // Détecte les coffres les plus proches (jusqu'à 4), ou le plus proche s'il est au-delà
      const targets = detected
        .filter((c, idx) => c.dist <= MAX_RADAR_DIST || idx === 0)
        .slice(0, 4);

      const activeChestSet = new Set(targets.map((t) => t.chest));
      for (const [chest, el] of this.chestBeaconMap.entries()) {
        if (!activeChestSet.has(chest)) {
          el.remove();
          this.chestBeaconMap.delete(chest);
        }
      }

      let closestInFov = false;

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        let beaconEl = this.chestBeaconMap.get(target.chest);
        if (!beaconEl) {
          beaconEl = this.createChestBeaconElement();
          this.container.appendChild(beaconEl);
          this.chestBeaconMap.set(target.chest, beaconEl);
        }

        let angleDiff = Math.atan2(target.dy, target.dx) - player.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const inFov = Math.abs(angleDiff) <= player.fov / 2 + 0.12;

        if (i === 0 && inFov) {
          closestInFov = true;
        }

        if (!inFov) {
          beaconEl.style.display = 'none';
          continue;
        }

        const canvasX = (0.5 + angleDiff / player.fov) * 320;
        const screenCol = Math.floor(canvasX);

        let behindWall = false;
        if (screenCol >= 0 && screenCol < 320) {
          const ray = rayHits[screenCol];
          if (ray && ray.hit && target.dist > ray.distance + 0.15) {
            behindWall = true;
          }
        }

        const fullWallHeight = focalLength / target.dist;
        const floorScreenY = (240 + fullWallHeight) / 2;
        const anchorCanvasY = floorScreenY - (fullWallHeight * 0.42) / 2;

        const screenPixelX =
          canvasRect.left + (canvasX / 320) * canvasRect.width;
        const screenPixelY =
          canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

        const scale = Math.max(0.65, Math.min(1.2, 1.3 / Math.sqrt(target.dist)));

        beaconEl.style.display = 'flex';
        beaconEl.style.left = `${screenPixelX}px`;
        beaconEl.style.top = `${screenPixelY}px`;
        beaconEl.style.transform = `translate(-50%, -50%) scale(${scale})`;

        this.updateChestBeaconContent(beaconEl, target.dist, behindWall);
      }

      // Indicateur sur le bord de l'écran pour guider vers le coffre le plus proche s'il est hors champ
      if (targets.length > 0 && !closestInFov) {
        const closest = targets[0];
        let angleDiff = Math.atan2(closest.dy, closest.dx) - player.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const edgeEl = this.getOrCreateEdgeBeaconElement();
        edgeEl.style.display = 'flex';

        const isLeft = angleDiff < 0;
        const edgeX = isLeft
          ? canvasRect.left + 54
          : canvasRect.left + canvasRect.width - 54;
        const edgeY = canvasRect.top + canvasRect.height * 0.5;

        edgeEl.style.left = `${edgeX}px`;
        edgeEl.style.top = `${edgeY}px`;

        const label = edgeEl.querySelector('.edge-text');
        if (label) {
          label.textContent = isLeft
            ? `◄ COFFRE ${closest.dist.toFixed(1)}m`
            : `${closest.dist.toFixed(1)}m COFFRE ►`;
        }
      } else if (this.edgeBeaconEl) {
        this.edgeBeaconEl.style.display = 'none';
      }
    }

    // =========================================================================
    // 5. EN-TÊTE DU MARCHAND DANS LE MONDE 3D
    // =========================================================================
    const activeMerchants = new Set<Merchant>();
    for (const entity of entities) {
      if (entity instanceof Merchant && entity.active) {
        activeMerchants.add(entity);
      }
    }

    for (const [merch, el] of this.merchantMap.entries()) {
      if (!activeMerchants.has(merch)) {
        el.remove();
        this.merchantMap.delete(merch);
      }
    }

    for (const merch of activeMerchants) {
      let merchEl = this.merchantMap.get(merch);
      if (!merchEl) {
        merchEl = this.createMerchantElement();
        this.container.appendChild(merchEl);
        this.merchantMap.set(merch, merchEl);
      }

      const dx = merch.x - player.x;
      const dy = merch.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.2 || distance > 9.5) {
        merchEl.style.display = 'none';
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.1) {
        merchEl.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Z-buffer occlusion
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.12) {
          merchEl.style.display = 'none';
          continue;
        }
      }

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const topOfSpriteScreenY = floorScreenY - fullWallHeight * merch.getScale();
      const anchorCanvasY = topOfSpriteScreenY - 14;

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      const scale = Math.max(0.7, Math.min(1.2, 1.4 / Math.sqrt(distance)));

      merchEl.style.display = 'flex';
      merchEl.style.left = `${screenPixelX}px`;
      merchEl.style.top = `${screenPixelY}px`;
      merchEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }

    // =========================================================================
    // 6. EN-TÊTE DES PORTES DANS LE MONDE 3D
    // =========================================================================
    const activeDoors = new Set<Door>();
    for (const entity of entities) {
      if (entity instanceof Door && entity.active && entity.isInteractable()) {
        activeDoors.add(entity);
      }
    }

    for (const [door, el] of this.doorMap.entries()) {
      if (!activeDoors.has(door)) {
        el.remove();
        this.doorMap.delete(door);
      }
    }

    for (const door of activeDoors) {
      let doorEl = this.doorMap.get(door);
      if (!doorEl) {
        doorEl = this.createDoorElement(door);
        this.container.appendChild(doorEl);
        this.doorMap.set(door, doorEl);
      }

      const dx = door.x - player.x;
      const dy = door.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.2 || distance > 9.0) {
        doorEl.style.display = 'none';
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.1) {
        doorEl.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Z-buffer occlusion
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.15) {
          doorEl.style.display = 'none';
          continue;
        }
      }

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const topOfDoorScreenY = floorScreenY - fullWallHeight;
      const anchorCanvasY = topOfDoorScreenY - 14;

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      const scale = Math.max(0.7, Math.min(1.2, 1.4 / Math.sqrt(distance)));

      doorEl.style.display = 'flex';
      doorEl.style.left = `${screenPixelX}px`;
      doorEl.style.top = `${screenPixelY}px`;
      doorEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }

    // =========================================================================
    // 6. EN-TÊTES ET BARRES DE VIE DES JOUEURS DISTANTS (MULTIJOUEUR)
    // =========================================================================
    const activeRemotePlayers = new Set<RemotePlayer>();
    for (const entity of entities) {
      if (entity instanceof RemotePlayer && entity.active && entity.hp > 0) {
        activeRemotePlayers.add(entity);
      }
    }

    for (const [remote, el] of this.remotePlayerMap.entries()) {
      if (!activeRemotePlayers.has(remote)) {
        el.remove();
        this.remotePlayerMap.delete(remote);
      }
    }

    for (const remote of activeRemotePlayers) {
      let el = this.remotePlayerMap.get(remote);
      if (!el) {
        el = this.createRemotePlayerElement(remote);
        this.container.appendChild(el);
        this.remotePlayerMap.set(remote, el);
      }

      const dx = remote.x - player.x;
      const dy = remote.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.2 || distance > 18.0) {
        el.style.display = 'none';
        continue;
      }

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > player.fov / 2 + 0.15) {
        el.style.display = 'none';
        continue;
      }

      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Z-buffer occlusion
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.15) {
          el.style.display = 'none';
          continue;
        }
      }

      this.updateRemotePlayerElement(el, remote);

      const fullWallHeight = focalLength / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const bottomScreenY = floorScreenY - fullWallHeight * remote.getElevation();
      const topOfSpriteScreenY = bottomScreenY - fullWallHeight * remote.getScale();
      const anchorCanvasY = topOfSpriteScreenY - 14;

      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      const scale = Math.max(0.65, Math.min(1.25, 1.45 / Math.sqrt(distance)));

      el.style.display = 'flex';
      el.style.left = `${screenPixelX}px`;
      el.style.top = `${screenPixelY}px`;
      el.style.transform = `translate(-50%, -100%) scale(${scale})`;
    }
  }

  public setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }

  public clear(): void {
    for (const cardEl of this.cardMap.values()) {
      cardEl.remove();
    }
    this.cardMap.clear();

    for (const enemyEl of this.enemyMap.values()) {
      enemyEl.remove();
    }
    this.enemyMap.clear();

    for (const portalEl of this.portalMap.values()) {
      portalEl.remove();
    }
    this.portalMap.clear();

    for (const beaconEl of this.chestBeaconMap.values()) {
      beaconEl.remove();
    }
    this.chestBeaconMap.clear();

    for (const merchEl of this.merchantMap.values()) {
      merchEl.remove();
    }
    this.merchantMap.clear();

    for (const doorEl of this.doorMap.values()) {
      doorEl.remove();
    }
    this.doorMap.clear();

    for (const playerEl of this.remotePlayerMap.values()) {
      playerEl.remove();
    }
    this.remotePlayerMap.clear();

    if (this.edgeBeaconEl) {
      this.edgeBeaconEl.remove();
      this.edgeBeaconEl = null;
    }
  }

  private createRemotePlayerElement(remote: RemotePlayer): HTMLElement {
    const el = document.createElement('div');
    el.className = 'world-remote-player-overhead';

    const header = document.createElement('div');
    header.className = 'remote-player-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'remote-player-name';
    nameEl.textContent = `🧙 ${remote.name}`;
    header.appendChild(nameEl);

    const gsEl = document.createElement('div');
    gsEl.className = 'remote-player-gs';
    gsEl.textContent = `⭐ ${remote.gearScore}`;
    header.appendChild(gsEl);

    el.appendChild(header);

    const barFrame = document.createElement('div');
    barFrame.className = 'remote-player-bar-frame';

    const fill = document.createElement('div');
    fill.className = 'remote-player-bar-fill';
    barFrame.appendChild(fill);

    const textHp = document.createElement('div');
    textHp.className = 'remote-player-hp-text';
    textHp.textContent = `${remote.hp} / ${remote.maxHp}`;
    barFrame.appendChild(textHp);

    el.appendChild(barFrame);
    return el;
  }

  private updateRemotePlayerElement(el: HTMLElement, remote: RemotePlayer): void {
    const fill = el.querySelector<HTMLElement>('.remote-player-bar-fill');
    const textHp = el.querySelector<HTMLElement>('.remote-player-hp-text');
    const gsEl = el.querySelector<HTMLElement>('.remote-player-gs');
    const pct = Math.max(0, Math.min(100, Math.round((remote.hp / remote.maxHp) * 100)));

    if (fill) {
      fill.style.width = `${pct}%`;
    }
    if (textHp) {
      textHp.textContent = `${remote.hp} / ${remote.maxHp}`;
    }
    if (gsEl) {
      gsEl.textContent = `⭐ ${remote.gearScore}`;
    }
  }

  // =========================================================================
  // CRÉATION DES ÉLÉMENTS DOM
  // =========================================================================

  private createEnemyElement(
    enemy: Enemy,
    hpInfo: {
      percent: number;
      health: number;
      maxHealth: number;
      rank: 'normal' | 'elite' | 'boss';
      name: string;
      typeId?: string;
      hatchRemaining?: number;
      hatchRatio?: number;
    }
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = `world-enemy-overhead rank-${hpInfo.rank}${hpInfo.typeId === 'pumpkin_seed' ? ' is-pumpkin-seed' : ''}`;

    // Si c'est une graine de citrouille : timer circulaire de progression à l'envers au-dessus
    if (hpInfo.typeId === 'pumpkin_seed') {
      const hatchWidget = document.createElement('div');
      hatchWidget.className = 'seed-hatch-widget';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 36 36');
      svg.setAttribute('class', 'seed-circular-svg');

      const circleTrack = document.createElementNS(svgNS, 'circle');
      circleTrack.setAttribute('class', 'seed-circle-track');
      circleTrack.setAttribute('cx', '18');
      circleTrack.setAttribute('cy', '18');
      circleTrack.setAttribute('r', '14');
      svg.appendChild(circleTrack);

      const circleBar = document.createElementNS(svgNS, 'circle');
      circleBar.setAttribute('class', 'seed-circle-bar');
      circleBar.setAttribute('cx', '18');
      circleBar.setAttribute('cy', '18');
      circleBar.setAttribute('r', '14');
      circleBar.setAttribute('stroke-dasharray', '88');
      circleBar.setAttribute('stroke-dashoffset', '0');
      svg.appendChild(circleBar);

      hatchWidget.appendChild(svg);

      const timeText = document.createElement('div');
      timeText.className = 'seed-circular-text';
      timeText.textContent = `${(hpInfo.hatchRemaining ?? 5.5).toFixed(1)}s`;
      hatchWidget.appendChild(timeText);

      el.appendChild(hatchWidget);
    }

    // 1. En-tête Deadlock : Titre / Rang & Compteur de PV chiffré
    const headerEl = document.createElement('div');
    headerEl.className = 'deadlock-mob-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'deadlock-mob-title';
    const prefix =
      hpInfo.rank === 'boss' ? '👑 ' : hpInfo.rank === 'elite' ? '★ ' : '';
    titleEl.textContent = `${prefix}${enemy.type.name.toUpperCase()}`;
    headerEl.appendChild(titleEl);

    const hpNumEl = document.createElement('div');
    hpNumEl.className = 'deadlock-hp-number';
    hpNumEl.textContent = `${hpInfo.health} / ${hpInfo.maxHealth}`;
    headerEl.appendChild(hpNumEl);

    el.appendChild(headerEl);

    // 2. Châssis de jauge Deadlock (biseauté / anguleux)
    const frameEl = document.createElement('div');
    frameEl.className = 'deadlock-bar-frame';

    const trackEl = document.createElement('div');
    trackEl.className = 'deadlock-bar-track';

    // Ghost damage bar (se résorbe après l'impact pour sensation punchy façon Deadlock)
    const ghostEl = document.createElement('div');
    ghostEl.className = 'deadlock-bar-ghost';
    ghostEl.style.width = `${Math.round(hpInfo.percent * 100)}%`;
    trackEl.appendChild(ghostEl);

    // Remplissage de vie principal
    const fillEl = document.createElement('div');
    fillEl.className = 'deadlock-bar-fill';
    fillEl.style.width = `${Math.round(hpInfo.percent * 100)}%`;
    trackEl.appendChild(fillEl);

    // Encoches / Segments de graduation tactique façon Deadlock
    const segmentsEl = document.createElement('div');
    segmentsEl.className = 'deadlock-bar-segments';
    trackEl.appendChild(segmentsEl);

    frameEl.appendChild(trackEl);
    el.appendChild(frameEl);

    return el;
  }

  private updateEnemyElement(
    el: HTMLElement,
    hpInfo: {
      percent: number;
      health: number;
      maxHealth: number;
      rank: 'normal' | 'elite' | 'boss';
      typeId?: string;
      hatchRemaining?: number;
      hatchRatio?: number;
    }
  ): void {
    const fill = el.querySelector<HTMLElement>('.deadlock-bar-fill');
    const ghost = el.querySelector<HTMLElement>('.deadlock-bar-ghost');
    const hpNum = el.querySelector<HTMLElement>('.deadlock-hp-number');

    const percent = Math.round(hpInfo.percent * 100);

    if (hpNum) {
      hpNum.textContent = `${hpInfo.health} / ${hpInfo.maxHealth}`;
    }

    if (fill) {
      fill.style.width = `${percent}%`;
      if (hpInfo.percent <= 0.25) {
        fill.classList.add('critical');
      } else {
        fill.classList.remove('critical');
      }
    }

    if (ghost) {
      ghost.style.width = `${percent}%`;
    }

    // Mise à jour du cercle de progression à l'envers de la graine
    if (hpInfo.typeId === 'pumpkin_seed' && hpInfo.hatchRatio !== undefined) {
      const circleBar = el.querySelector<SVGCircleElement>('.seed-circle-bar');
      const timeText = el.querySelector<HTMLElement>('.seed-circular-text');
      const ratio = Math.max(0, Math.min(1, hpInfo.hatchRatio)); // 1.0 (plein) -> 0.0 (vide)

      if (circleBar) {
        // Le cercle se vide dans le sens horaire depuis 12h : dashoffset augmente de 0 à 88
        const offset = 88 * (1 - ratio);
        circleBar.setAttribute('stroke-dashoffset', offset.toFixed(1));

        if (ratio <= 0.3) {
          circleBar.style.stroke = '#ef4444';
        } else if (ratio <= 0.6) {
          circleBar.style.stroke = '#f97316';
        } else {
          circleBar.style.stroke = '#84cc16';
        }
      }

      if (timeText && hpInfo.hatchRemaining !== undefined) {
        timeText.textContent = `${hpInfo.hatchRemaining.toFixed(1)}s`;
        if (ratio <= 0.3) {
          timeText.classList.add('imminent');
        } else {
          timeText.classList.remove('imminent');
        }
      }
    }
  }

  private createPortalElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'world-portal-badge';
    return el;
  }

  private updatePortalElement(
    el: HTMLElement,
    info: { name: string; isActive: boolean; remainingSec: number }
  ): void {
    if (info.isActive) {
      el.className = 'world-portal-badge active';
      el.textContent = `🌀 ${info.name.toUpperCase()} [OUVERT]`;
    } else {
      el.className = 'world-portal-badge inactive';
      el.textContent = `⏳ ${info.name.toUpperCase()} (${info.remainingSec}s)`;
    }
  }

  private createCardElement(
    item: EquipmentItem,
    comparedItem?: EquipmentItem | null
  ): HTMLElement {
    return createItemCardElement(item, comparedItem);
  }

  // =========================================================================
  // GESTION DU RADAR / BALISES DE COFFRES (HOMONCULUS)
  // =========================================================================

  private createChestBeaconElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'chest-beacon';
    el.innerHTML = `
      <div class="chest-beacon-pulse"></div>
      <div class="chest-beacon-box">
        <span class="chest-beacon-icon">📦</span>
        <span class="chest-beacon-label">COFFRE</span>
        <span class="chest-beacon-dist">--m</span>
      </div>
      <div class="chest-beacon-walltag" style="display: none;">À TRAVERS LE MUR</div>
    `;
    return el;
  }

  private updateChestBeaconContent(
    el: HTMLElement,
    distance: number,
    behindWall: boolean
  ): void {
    const distEl = el.querySelector('.chest-beacon-dist');
    if (distEl) {
      distEl.textContent = `${distance.toFixed(1)}m`;
    }
    const wallTag = el.querySelector('.chest-beacon-walltag') as HTMLElement | null;
    if (wallTag) {
      wallTag.style.display = behindWall ? 'block' : 'none';
    }
    const box = el.querySelector('.chest-beacon-box') as HTMLElement | null;
    if (box) {
      if (behindWall) {
        box.style.borderColor = '#c084fc';
        box.style.background = 'rgba(28, 14, 48, 0.88)';
        box.style.opacity = '0.92';
      } else {
        box.style.borderColor = '#ffd700';
        box.style.background = 'rgba(38, 22, 10, 0.95)';
        box.style.opacity = '1.0';
      }
    }
  }

  private getOrCreateEdgeBeaconElement(): HTMLElement {
    if (!this.edgeBeaconEl && this.container) {
      this.edgeBeaconEl = document.createElement('div');
      this.edgeBeaconEl.className = 'chest-beacon chest-beacon-edge';
      this.edgeBeaconEl.innerHTML = `
        <div class="chest-beacon-box" style="border-color: #e879f9;">
          <span class="chest-beacon-icon">🔮</span>
          <span class="chest-beacon-label edge-text">COFFRE</span>
        </div>
      `;
      this.container.appendChild(this.edgeBeaconEl);
    }
    return this.edgeBeaconEl!;
  }

  private createMerchantElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'world-merchant-overhead';
    el.innerHTML = `
      <div class="merchant-overhead-box">
        <span class="merchant-overhead-icon">🧙‍♂️</span>
        <span class="merchant-overhead-name">MARCHAND</span>
      </div>
    `;
    return el;
  }

  private createDoorElement(door: Door): HTMLElement {
    const el = document.createElement('div');
    el.className = 'world-door-overhead';
    const isSanctum = door.requiredKeyId === 'key_crypt_skull';
    const label = isSanctum ? '⛩️ SANCTUAIRE (ZONE 3)' : '🚪 SECTEUR (ZONE 1)';
    const borderColor = isSanctum ? '#ffd700' : '#a855f7';
    el.innerHTML = `
      <div class="door-overhead-box" style="border-color: ${borderColor};">
        <span class="door-overhead-name">${label}</span>
      </div>
    `;
    return el;
  }
}
