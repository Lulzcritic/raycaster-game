import type { Entity } from '../entities/Entity';
import { DroppedItemOrb } from '../entities/DroppedItemOrb';
import { Enemy } from '../entities/Enemy';
import { ExtractionPortal } from '../entities/ExtractionPortal';
import { RARITY_COLORS, RARITY_LABELS } from '../entities/ItemCardBillboard';
import type { Player } from '../entities/Player';
import type { Renderer } from '../graphics/Renderer';
import type { EquipmentItem, ItemStats } from '../types';

const STAT_LABELS: Array<{
  key: keyof ItemStats;
  label: string;
  isMultiplier?: boolean;
}> = [
  { key: 'damage', label: 'Degats' },
  { key: 'magicPower', label: 'Puissance magique' },
  { key: 'defense', label: 'Defense' },
  { key: 'maxHealth', label: 'Sante max' },
  { key: 'moveSpeed', label: 'Vitesse de deplacement', isMultiplier: true },
  { key: 'castSpeed', label: "Vitesse d'incantation", isMultiplier: true },
  { key: 'stealth', label: 'Discretion' },
  { key: 'charisma', label: 'Charisme' },
];

/**
 * Gestionnaire d'affichage haute résolution dans le monde 3D :
 * - Fiches d'objets flottant au-dessus des orbes
 * - Barres de vie et noms au-dessus des monstres (Blobs, Élites, Boss)
 * - Indicateurs d'état et chronos au-dessus des portails d'extraction
 *
 * Le rendu est effectué en HTML/DOM haute résolution (typographie nette non-pixelisée).
 */
export class WorldBillboardOverlay {
  private readonly container: HTMLElement | null;
  private readonly cardMap = new Map<DroppedItemOrb, HTMLElement>();
  private readonly enemyMap = new Map<Enemy, HTMLElement>();
  private readonly portalMap = new Map<ExtractionPortal, HTMLElement>();

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
    // 1. FICHES D'OBJETS AU SOL (ORBES)
    // =========================================================================
    const activeOrbs = new Set<DroppedItemOrb>();
    for (const entity of entities) {
      if (entity instanceof DroppedItemOrb && entity.active) {
        activeOrbs.add(entity);
      }
    }

    for (const [orb, cardEl] of this.cardMap.entries()) {
      if (!activeOrbs.has(orb)) {
        cardEl.remove();
        this.cardMap.delete(orb);
      }
    }

    for (const orb of activeOrbs) {
      let cardEl = this.cardMap.get(orb);
      if (!cardEl) {
        cardEl = this.createCardElement(orb.item);
        this.container.appendChild(cardEl);
        this.cardMap.set(orb, cardEl);
      }

      if (!orb.hasLanded()) {
        cardEl.style.display = 'none';
        continue;
      }

      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      const distance = Math.hypot(dx, dy);

      const MAX_CARD_DISTANCE = 2.2;
      const FADE_START_DISTANCE = 1.6;

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
      const bottomScreenY = floorScreenY - fullWallHeight * orb.getElevation();
      const topOfOrbScreenY = bottomScreenY - fullWallHeight * orb.getScale();
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
    }
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = `world-enemy-overhead rank-${hpInfo.rank}`;

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

  private createCardElement(item: EquipmentItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'world-item-card';

    const rarityColor = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
    card.style.borderColor = rarityColor;
    card.style.boxShadow = `0 0 0 2px #000, inset 0 0 0 2px #0a0814, 5px 5px 0 #000`;

    // 1. Image de l'item en haut
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'world-card-icon-wrapper';
    iconWrapper.style.borderColor = rarityColor;
    iconWrapper.style.boxShadow = `0 0 0 2px #000, inset 0 0 0 1px #000, 3px 3px 0 #000`;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.className = 'world-card-icon';
    iconCanvas.width = 16;
    iconCanvas.height = 16;
    this.renderPixelIcon(iconCanvas, item);
    iconWrapper.appendChild(iconCanvas);
    card.appendChild(iconWrapper);

    // 2. Nom de l'item avec la couleur liée à sa rareté
    const nameEl = document.createElement('div');
    nameEl.className = 'world-card-name';
    nameEl.textContent = item.name;
    nameEl.style.color = rarityColor;
    card.appendChild(nameEl);

    // Badge de rareté rétro pixel-art
    const badgeEl = document.createElement('div');
    badgeEl.className = 'world-card-rarity';
    badgeEl.textContent = `[ ${RARITY_LABELS[item.rarity] ?? 'OBJET'} ]`;
    badgeEl.style.color = rarityColor;
    badgeEl.style.borderColor = rarityColor;
    card.appendChild(badgeEl);

    // 3. Stats de l'item en blanc
    const statsContainer = document.createElement('div');
    statsContainer.className = 'world-card-stats';

    let hasStat = false;
    for (const statDef of STAT_LABELS) {
      const rawValue = item.stats[statDef.key];
      if (rawValue === undefined || rawValue === 0) {
        continue;
      }
      hasStat = true;
      const line = document.createElement('div');
      line.className = 'world-card-stat-line';
      const sign = rawValue > 0 ? '+' : '';
      line.textContent = statDef.isMultiplier
        ? `${sign}${Math.round(rawValue * 100)}% ${statDef.label}`
        : `${sign}${rawValue} ${statDef.label}`;
      statsContainer.appendChild(line);
    }

    if (hasStat) {
      card.appendChild(statsContainer);
    }

    // 4. Effet de l'item en vert s'il en a un
    if (item.effect && item.effect.trim().length > 0) {
      const effectEl = document.createElement('div');
      effectEl.className = 'world-card-effect';
      effectEl.innerHTML = `<span class="world-card-effect-tag">✦ Effet :</span> ${item.effect}`;
      card.appendChild(effectEl);
    }

    // 5. Petite description en jaune
    if (item.description && item.description.trim().length > 0) {
      const descEl = document.createElement('div');
      descEl.className = 'world-card-description';
      descEl.textContent = `« ${item.description} »`;
      card.appendChild(descEl);
    }

    return card;
  }

  private renderPixelIcon(canvas: HTMLCanvasElement, item: EquipmentItem): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const SLOT_PALETTES: Record<string, { bg: string; fill: string; outline: string }> = {
      hat: { bg: '#1c152b', fill: '#8062b8', outline: '#3d2e59' },
      weapon: { bg: '#241b16', fill: '#c27d44', outline: '#472f1e' },
      armor: { bg: '#1b1b26', fill: '#646894', outline: '#33354d' },
      boots: { bg: '#211d16', fill: '#9c8143', outline: '#423720' },
      key: { bg: '#221a0d', fill: '#ffcc00', outline: '#4a3a16' },
    };

    const palette = SLOT_PALETTES[item.slot] ?? {
      bg: '#161421',
      fill: '#a09ab3',
      outline: '#383347',
    };

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = palette.fill;
    if (item.slot === 'hat') {
      ctx.fillRect(7, 2, 2, 2);
      ctx.fillRect(6, 4, 4, 3);
      ctx.fillRect(5, 7, 6, 3);
      ctx.fillRect(2, 10, 12, 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(5, 9, 6, 1);
    } else if (item.slot === 'weapon') {
      ctx.fillRect(11, 2, 3, 3);
      ctx.fillRect(9, 4, 3, 3);
      ctx.fillRect(7, 6, 3, 3);
      ctx.fillRect(5, 8, 3, 3);
      ctx.fillRect(3, 10, 3, 3);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(12, 3, 1, 1);
    } else if (item.slot === 'armor') {
      ctx.fillRect(3, 3, 10, 3);
      ctx.fillRect(5, 6, 6, 7);
      ctx.fillRect(2, 4, 2, 4);
      ctx.fillRect(12, 4, 2, 4);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(7, 4, 2, 2);
    } else if (item.slot === 'boots') {
      ctx.fillRect(4, 3, 4, 7);
      ctx.fillRect(4, 10, 8, 3);
      ctx.fillStyle = '#c49a35';
      ctx.fillRect(4, 3, 4, 1);
    } else if (item.slot === 'key') {
      ctx.fillRect(3, 4, 6, 6);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(5, 5, 2, 4);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(8, 6, 6, 2);
      ctx.fillRect(12, 8, 2, 3);
      ctx.fillRect(10, 8, 1, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 1);
    }
  }
}
