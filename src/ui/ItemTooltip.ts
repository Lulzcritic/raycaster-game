import type { EquipmentItem, ItemStats } from '../types';
import { RARITY_COLORS, RARITY_LABELS } from '../entities/ItemCardBillboard';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';

export const ITEM_CARD_STAT_LABELS: Array<{
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
 * Remplit un élément DOM avec la carte d'information complète de l'objet en jeu
 */
export function fillItemCardElement(card: HTMLElement, item: EquipmentItem): void {
  card.innerHTML = '';
  const rarityColor = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
  card.style.borderColor = rarityColor;
  card.style.boxShadow = `0 0 0 2px #000, inset 0 0 0 2px #0a0814, 5px 5px 0 #000`;

  // 1. Image / Icône de l'item en haut
  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'world-card-icon-wrapper';
  iconWrapper.style.borderColor = rarityColor;
  iconWrapper.style.boxShadow = `0 0 0 2px #000, inset 0 0 0 1px #000, 3px 3px 0 #000`;

  const iconCanvas = document.createElement('canvas');
  iconCanvas.className = 'world-card-icon';
  iconCanvas.width = 36;
  iconCanvas.height = 36;
  ItemSpriteManager.renderToCanvas(iconCanvas, item);

  const img = ItemSpriteManager.getItemImage(item);
  if (img && !img.complete) {
    img.addEventListener(
      'load',
      () => {
        ItemSpriteManager.renderToCanvas(iconCanvas, item);
      },
      { once: true }
    );
  }

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
  for (const statDef of ITEM_CARD_STAT_LABELS) {
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

  // 4. Effet spécial de l'item en vert s'il en a un
  if (item.effect && item.effect.trim().length > 0) {
    const effectEl = document.createElement('div');
    effectEl.className = 'world-card-effect';
    effectEl.innerHTML = `<span class="world-card-effect-tag">✦ Effet :</span> ${item.effect}`;
    card.appendChild(effectEl);
  }

  // 5. Description poétique ou lore en jaune
  if (item.description && item.description.trim().length > 0) {
    const descEl = document.createElement('div');
    descEl.className = 'world-card-description';
    descEl.textContent = `« ${item.description} »`;
    card.appendChild(descEl);
  }
}

/**
 * Crée un élément DOM neuf contenant la carte d'item en jeu
 */
export function createItemCardElement(item: EquipmentItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'world-item-card';
  fillItemCardElement(card, item);
  return card;
}

/**
 * Infobulle flottante globale suivant le curseur de la souris pour les équipements
 */
export class ItemTooltip {
  private static instance: ItemTooltip | null = null;
  private tooltipEl: HTMLElement | null = null;
  private currentItem: EquipmentItem | null = null;
  private isVisible = false;

  private constructor() {
    this.createTooltipElement();
    window.addEventListener('blur', () => this.hide());
  }

  public static getInstance(): ItemTooltip {
    if (!ItemTooltip.instance) {
      ItemTooltip.instance = new ItemTooltip();
    }
    return ItemTooltip.instance;
  }

  private createTooltipElement(): HTMLElement {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'world-item-card hub-item-tooltip';
      document.body.appendChild(this.tooltipEl);
    }
    return this.tooltipEl;
  }

  public show(item: EquipmentItem, clientX: number, clientY: number): void {
    const el = this.createTooltipElement();
    if (this.currentItem !== item) {
      this.currentItem = item;
      fillItemCardElement(el, item);
    }
    el.classList.add('visible');
    this.isVisible = true;
    this.updatePosition(clientX, clientY);
  }

  public updatePosition(clientX: number, clientY: number): void {
    if (!this.isVisible || !this.tooltipEl) return;

    const PADDING = 14;
    const OFFSET_X = 18;
    const OFFSET_Y = 18;

    const rect = this.tooltipEl.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 250;
    const height = rect.height > 0 ? rect.height : 260;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = clientX + OFFSET_X;
    let top = clientY + OFFSET_Y;

    // Si l'infobulle dépasse sur la droite de l'écran, on la bascule à gauche du curseur
    if (left + width > vw - PADDING) {
      left = clientX - width - OFFSET_X;
    }
    if (left < PADDING) {
      left = PADDING;
    }

    // Si l'infobulle dépasse en bas de l'écran, on la bascule au-dessus du curseur
    if (top + height > vh - PADDING) {
      top = clientY - height - OFFSET_Y;
    }
    if (top < PADDING) {
      top = PADDING;
    }

    this.tooltipEl.style.left = `${Math.round(left)}px`;
    this.tooltipEl.style.top = `${Math.round(top)}px`;
  }

  public hide(): void {
    if (!this.tooltipEl || !this.isVisible) return;
    this.tooltipEl.classList.remove('visible');
    this.isVisible = false;
    this.currentItem = null;
  }

  /**
   * Attache les écouteurs de survol de souris à un élément HTML
   */
  public attach(
    element: HTMLElement,
    getItem: () => EquipmentItem | null | undefined
  ): void {
    element.addEventListener('mouseenter', (e: MouseEvent) => {
      const item = getItem();
      if (item) {
        this.show(item, e.clientX, e.clientY);
      } else {
        this.hide();
      }
    });

    element.addEventListener('mousemove', (e: MouseEvent) => {
      const item = getItem();
      if (item) {
        if (!this.isVisible) {
          this.show(item, e.clientX, e.clientY);
        } else {
          this.updatePosition(e.clientX, e.clientY);
        }
      } else {
        this.hide();
      }
    });

    element.addEventListener('mouseleave', () => {
      this.hide();
    });
  }
}
