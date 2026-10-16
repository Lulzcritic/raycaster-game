import type { Entity } from '../entities/Entity';
import { DroppedItemOrb } from '../entities/DroppedItemOrb';
import { RARITY_COLORS, RARITY_LABELS } from '../entities/ItemCardBillboard';
import type { Player } from '../entities/Player';
import type { Renderer } from '../graphics/Renderer';
import type { EquipmentItem, ItemStats } from '../types';

const STAT_LABELS: Array<{
  key: keyof ItemStats;
  label: string;
  isMultiplier?: boolean;
}> = [
  { key: 'damage', label: 'Dégâts' },
  { key: 'magicPower', label: 'Puissance magique' },
  { key: 'defense', label: 'Défense' },
  { key: 'maxHealth', label: 'Santé max' },
  { key: 'moveSpeed', label: 'Vitesse de déplacement', isMultiplier: true },
  { key: 'castSpeed', label: "Vitesse d'incantation", isMultiplier: true },
  { key: 'stealth', label: 'Discrétion' },
  { key: 'charisma', label: 'Charisme' },
];

/**
 * Gestionnaire d'affichage des fiches d'objets flottant au-dessus des orbes dans le monde 3D
 * Rendu avec une typographie normale haute résolution pour une lisibilité parfaite
 */
export class WorldBillboardOverlay {
  private readonly container: HTMLElement | null;
  private readonly cardMap = new Map<DroppedItemOrb, HTMLElement>();

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

    // 1. Récupération des orbes au sol actifs
    const activeOrbs = new Set<DroppedItemOrb>();

    for (const entity of entities) {
      if (entity instanceof DroppedItemOrb && entity.active) {
        activeOrbs.add(entity);
      }
    }

    // 2. Nettoyage des cartes des orbes qui ont été ramassés ou désactivés
    for (const [orb, cardEl] of this.cardMap.entries()) {
      if (!activeOrbs.has(orb)) {
        cardEl.remove();
        this.cardMap.delete(orb);
      }
    }

    // 3. Projection 3D et positionnement de chaque fiche au-dessus de son orbe
    for (const orb of activeOrbs) {
      let cardEl = this.cardMap.get(orb);
      if (!cardEl) {
        cardEl = this.createCardElement(orb.item);
        this.container.appendChild(cardEl);
        this.cardMap.set(orb, cardEl);
      }

      // 1. Masquer la fiche tant que l'orbe n'a pas atterri au sol
      if (!orb.hasLanded()) {
        cardEl.style.display = 'none';
        continue;
      }

      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      const distance = Math.hypot(dx, dy);

      // 2. Distance de visibilité : inspection uniquement à proximité (pas de trop loin)
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

      // Hors du champ de vision
      if (Math.abs(angleDiff) > player.fov / 2 + 0.12) {
        cardEl.style.display = 'none';
        continue;
      }

      // Colonne d'écran sur le canvas 320x240
      const canvasX = (0.5 + angleDiff / player.fov) * 320;
      const screenCol = Math.floor(canvasX);

      // Occlusion par les murs (Z-Buffer)
      if (screenCol >= 0 && screenCol < 320) {
        const ray = rayHits[screenCol];
        if (ray && ray.hit && distance > ray.distance + 0.08) {
          cardEl.style.display = 'none';
          continue;
        }
      }

      // Projection verticale au-dessus de l'orbe
      const fullWallHeight = renderer.getFocalLength() / distance;
      const floorScreenY = (240 + fullWallHeight) / 2;
      const bottomScreenY = floorScreenY - fullWallHeight * orb.getElevation();
      const topOfOrbScreenY = bottomScreenY - fullWallHeight * orb.getScale();
      const floatGap = 10;
      let anchorCanvasY = topOfOrbScreenY - floatGap;

      // Garde la base de la fiche visible dans la fenêtre sans la repousser hors de l'écran en bas
      anchorCanvasY = Math.min(anchorCanvasY, 204);

      // Conversion vers les coordonnées physiques de l'écran utilisateur
      const screenPixelX =
        canvasRect.left + (canvasX / 320) * canvasRect.width;
      const screenPixelY =
        canvasRect.top + (anchorCanvasY / 240) * canvasRect.height;

      // Échelle perspective directe : grandit en s'approchant, rétrécit avec l'éloignement
      const scale = Math.max(0.48, Math.min(1.4, 1.15 / distance));

      cardEl.style.display = 'flex';
      cardEl.style.left = `${screenPixelX}px`;
      cardEl.style.top = `${screenPixelY}px`;
      cardEl.style.transform = `translate(-50%, -100%) scale(${scale})`;
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

    // Silhouette / icône par catégorie d'équipement
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
      // Anneau de la clé (tête dorée avec trou central)
      ctx.fillRect(3, 4, 6, 6);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(5, 5, 2, 4);
      // Tige
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(8, 6, 6, 2);
      // Dents
      ctx.fillRect(12, 8, 2, 3);
      ctx.fillRect(10, 8, 1, 2);
      // Reflet brillant
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 2, 1);
    }
  }
}
