import { RARITY_COLORS, RARITY_LABELS } from '../entities/ItemCardBillboard';
import type { Merchant, MysteryCard } from '../entities/Merchant';
import type { EquipmentItem, ItemStats } from '../types';

const STAT_LABELS: Array<{
  key: keyof ItemStats;
  label: string;
  isMultiplier?: boolean;
}> = [
  { key: 'damage', label: 'Dégâts' },
  { key: 'magicPower', label: 'Puiss. Magique' },
  { key: 'defense', label: 'Défense' },
  { key: 'maxHealth', label: 'Santé Max' },
  { key: 'moveSpeed', label: 'Vit. Déplacement', isMultiplier: true },
  { key: 'castSpeed', label: 'Vit. Incantation', isMultiplier: true },
  { key: 'stealth', label: 'Discrétion' },
  { key: 'charisma', label: 'Charisme' },
];

export class MerchantUI {
  private readonly modal: HTMLElement | null;
  private readonly cardsContainer: HTMLElement | null;
  private readonly footerMessage: HTMLElement | null;
  private readonly closeBtn: HTMLElement | null;

  private currentMerchant: Merchant | null = null;
  private onClaimCallback?: (item: EquipmentItem) => void;
  private onCloseCallback?: () => void;
  private isModalOpen = false;

  constructor() {
    this.modal = document.getElementById('merchant-modal');
    this.cardsContainer = document.getElementById('merchant-cards-container');
    this.footerMessage = document.getElementById('merchant-footer-message');
    this.closeBtn = document.getElementById('merchant-close-btn');

    this.closeBtn?.addEventListener('click', () => {
      this.close();
    });
  }

  public isOpen(): boolean {
    return this.isModalOpen;
  }

  public open(
    merchant: Merchant,
    onClaim: (item: EquipmentItem) => void,
    onClose?: () => void
  ): void {
    this.currentMerchant = merchant;
    this.onClaimCallback = onClaim;
    this.onCloseCallback = onClose;
    this.isModalOpen = true;

    if (this.modal) {
      this.modal.classList.remove('hidden');
    }

    this.render();
  }

  public close(): void {
    if (!this.isModalOpen) return;
    this.isModalOpen = false;

    if (this.modal) {
      this.modal.classList.add('hidden');
    }

    const cb = this.onCloseCallback;
    this.currentMerchant = null;
    cb?.();
  }

  private render(): void {
    if (!this.cardsContainer || !this.currentMerchant) return;
    this.cardsContainer.innerHTML = '';

    const merchant = this.currentMerchant;

    if (merchant.isClaimed) {
      if (this.footerMessage) {
        this.footerMessage.textContent =
          '« Notre pacte est déjà scellé pour cette expédition. Bonne chance, voyageur. »';
      }
    } else {
      const allRevealed = merchant.cards.every((c) => c.revealed);
      const allRefused = merchant.cards.every((c) => c.refused);

      if (this.footerMessage) {
        if (allRefused) {
          this.footerMessage.textContent =
            '« Vous avez décliné toutes les cartes. Vous pouvez encore choisir ou quitter. »';
        } else if (allRevealed) {
          this.footerMessage.textContent =
            '« Toutes les cartes sont dévoilées. Choisissez votre offrande. »';
        } else {
          this.footerMessage.textContent =
            '✦ Cliquez sur une carte mystère pour dévoiler son contenu ✦';
        }
      }
    }

    merchant.cards.forEach((card, index) => {
      const cardEl = this.createCardElement(card, index);
      this.cardsContainer?.appendChild(cardEl);
    });
  }

  private createCardElement(card: MysteryCard, index: number): HTMLElement {
    const cardEl = document.createElement('div');
    const merchant = this.currentMerchant;
    const isMerchantClaimed = merchant ? merchant.isClaimed : false;

    // 1. CARTE NON RÉVÉLÉE (MYSTÈRE FACE CACHÉE)
    if (!card.revealed) {
      cardEl.className = 'merchant-card merchant-card-mystery';
      cardEl.innerHTML = `
        <div class="card-mystery-inner">
          <div class="card-mystery-rune">🔮</div>
          <div class="card-mystery-tag">CARTE DU DESTIN</div>
          <div class="card-mystery-num">${index === 0 ? 'I' : index === 1 ? 'II' : 'III'}</div>
          <div class="card-mystery-prompt">✦ Cliquer pour révéler ✦</div>
        </div>
      `;

      if (!isMerchantClaimed) {
        cardEl.addEventListener('click', () => {
          card.revealed = true;
          this.render();
        });
      }
      return cardEl;
    }

    // 2. CARTE RÉVÉLÉE (FACE DÉVOILÉE AVEC OBJET)
    const item = card.item;
    const rarityColor = RARITY_COLORS[item.rarity] ?? '#ffffff';
    const rarityLabel = RARITY_LABELS[item.rarity] ?? 'OBJET';

    cardEl.className = `merchant-card merchant-card-revealed ${card.taken ? 'taken' : ''} ${card.refused ? 'refused' : ''}`;
    cardEl.style.borderColor = rarityColor;
    cardEl.style.boxShadow = card.taken
      ? `0 0 24px rgba(255, 215, 0, 0.8), inset 0 0 16px rgba(255, 215, 0, 0.3)`
      : `0 0 16px ${rarityColor}55, 4px 4px 0 #000000`;

    // En-tête avec icône
    const headerEl = document.createElement('div');
    headerEl.className = 'merchant-card-header';

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'merchant-card-icon-box';
    iconWrapper.style.borderColor = rarityColor;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 16;
    iconCanvas.height = 16;
    this.renderPixelIcon(iconCanvas, item);
    iconWrapper.appendChild(iconCanvas);
    headerEl.appendChild(iconWrapper);

    // Titre et Rareté
    const titleEl = document.createElement('div');
    titleEl.className = 'merchant-card-title';
    titleEl.textContent = item.name.toUpperCase();
    titleEl.style.color = rarityColor;
    headerEl.appendChild(titleEl);

    const rarityEl = document.createElement('div');
    rarityEl.className = 'merchant-card-rarity';
    rarityEl.textContent = `[ ${rarityLabel} ]`;
    rarityEl.style.color = rarityColor;
    headerEl.appendChild(rarityEl);

    cardEl.appendChild(headerEl);

    // Statistiques
    const statsContainer = document.createElement('div');
    statsContainer.className = 'merchant-card-stats';
    let hasStats = false;
    for (const statDef of STAT_LABELS) {
      const val = item.stats[statDef.key];
      if (val !== undefined && val !== 0) {
        hasStats = true;
        const row = document.createElement('div');
        row.className = 'merchant-card-stat-row';
        const formatted = statDef.isMultiplier
          ? `${val > 0 ? '+' : ''}${Math.round(val * 100)}%`
          : `${val > 0 ? '+' : ''}${val}`;
        row.innerHTML = `<span>${statDef.label}</span><strong style="color: ${val > 0 ? '#4ade80' : '#f87171'}">${formatted}</strong>`;
        statsContainer.appendChild(row);
      }
    }
    if (hasStats) {
      cardEl.appendChild(statsContainer);
    }

    // Effet
    if (item.effect && item.effect.trim().length > 0) {
      const effectEl = document.createElement('div');
      effectEl.className = 'merchant-card-effect';
      effectEl.innerHTML = `<span style="color: #6ee7b7; font-weight: bold;">✦ Effet :</span> ${item.effect}`;
      cardEl.appendChild(effectEl);
    }

    // Description
    if (item.description && item.description.trim().length > 0) {
      const descEl = document.createElement('div');
      descEl.className = 'merchant-card-desc';
      descEl.textContent = `« ${item.description} »`;
      cardEl.appendChild(descEl);
    }

    // Actions au bas de la carte
    const actionsEl = document.createElement('div');
    actionsEl.className = 'merchant-card-actions';

    if (card.taken) {
      const takenBadge = document.createElement('div');
      takenBadge.className = 'merchant-badge-taken';
      takenBadge.textContent = '👑 CHOISI & ÉQUIPÉ';
      actionsEl.appendChild(takenBadge);
    } else if (isMerchantClaimed) {
      const lockBadge = document.createElement('div');
      lockBadge.className = 'merchant-badge-locked';
      lockBadge.textContent = '🔒 VERROUILLÉ';
      actionsEl.appendChild(lockBadge);
    } else {
      const takeBtn = document.createElement('button');
      takeBtn.type = 'button';
      takeBtn.className = 'merchant-btn merchant-btn-take';
      takeBtn.textContent = 'PRENDRE';
      takeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.taken = true;
        card.refused = false;
        if (merchant) {
          merchant.isClaimed = true;
        }
        this.onClaimCallback?.(card.item);
        this.render();
      });

      const refuseBtn = document.createElement('button');
      refuseBtn.type = 'button';
      refuseBtn.className = 'merchant-btn merchant-btn-refuse';
      refuseBtn.textContent = card.refused ? 'REFUSÉ' : 'REFUSER';
      if (card.refused) {
        refuseBtn.classList.add('active');
      }
      refuseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        card.refused = true;
        this.render();
      });

      actionsEl.appendChild(takeBtn);
      actionsEl.appendChild(refuseBtn);
    }

    cardEl.appendChild(actionsEl);
    return cardEl;
  }

  private renderPixelIcon(canvas: HTMLCanvasElement, item: EquipmentItem): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#0a0812';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#f8fafc';
    if (item.slot === 'hat') {
      ctx.fillRect(7, 2, 2, 2);
      ctx.fillRect(6, 4, 4, 3);
      ctx.fillRect(5, 7, 6, 3);
      ctx.fillRect(2, 10, 12, 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(5, 9, 6, 1);
    } else if (item.slot === 'weapon') {
      ctx.fillRect(11, 2, 3, 3);
      ctx.fillRect(9, 4, 3, 3);
      ctx.fillRect(7, 6, 3, 3);
      ctx.fillRect(5, 8, 3, 3);
      ctx.fillRect(3, 10, 3, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(12, 3, 1, 1);
    } else if (item.slot === 'armor') {
      ctx.fillRect(3, 3, 10, 3);
      ctx.fillRect(5, 6, 6, 7);
      ctx.fillRect(2, 4, 2, 4);
      ctx.fillRect(12, 4, 2, 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(7, 4, 2, 2);
    } else if (item.slot === 'boots') {
      ctx.fillRect(4, 3, 4, 7);
      ctx.fillRect(4, 10, 8, 3);
      ctx.fillStyle = '#c49a35';
      ctx.fillRect(4, 3, 4, 1);
    } else {
      ctx.fillRect(4, 4, 8, 8);
    }
  }
}
