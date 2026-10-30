import { RARITY_COLORS, RARITY_LABELS } from '../entities/ItemCardBillboard';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import type { Merchant, MysteryCard } from '../entities/Merchant';
import type { EquipmentItem, ItemStats } from '../types';
import { I18nService } from '../core/I18nService';

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
    const anyCardRevealed = merchant.cards.some((c) => c.revealed);
    const revealedCard = merchant.cards.find((c) => c.revealed);

    if (merchant.isClaimed) {
      if (this.footerMessage) {
        this.footerMessage.textContent =
          '« Notre pacte est déjà scellé pour cette expédition. Bonne chance, voyageur. »';
      }
    } else {
      if (this.footerMessage) {
        if (!anyCardRevealed) {
          this.footerMessage.textContent =
            '✦ Choisissez UNE seule carte mystère à retourner (les autres seront scellées) ✦';
        } else if (revealedCard?.taken) {
          this.footerMessage.textContent =
            '« Votre choix est fait. Que cet équipement vous guide vers la sortie. »';
        } else if (revealedCard?.refused) {
          this.footerMessage.textContent =
            '« Vous avez refusé cette offrande. Vous pouvez encore la prendre ou quitter avec [Échap]. »';
        } else {
          this.footerMessage.textContent =
            '✦ Prenez l\'objet révélé ou refusez-le. Les autres cartes restent scellées. ✦';
        }
      }
    }

    merchant.cards.forEach((card, index) => {
      const cardEl = this.createCardElement(card, index, anyCardRevealed);
      this.cardsContainer?.appendChild(cardEl);
    });
  }

  private createCardElement(
    card: MysteryCard,
    index: number,
    anyCardRevealed: boolean
  ): HTMLElement {
    const cardEl = document.createElement('div');
    const merchant = this.currentMerchant;
    const isMerchantClaimed = merchant ? merchant.isClaimed : false;

    // 1. CARTE NON RÉVÉLÉE (MYSTÈRE FACE CACHÉE)
    if (!card.revealed) {
      const isLocked = anyCardRevealed || isMerchantClaimed;
      cardEl.className = `merchant-card merchant-card-mystery ${isLocked ? 'locked' : ''}`;

      const runeText = isLocked ? '🔒' : '🔮';
      const runeStyle = isLocked ? 'animation: none; filter: none; opacity: 0.35;' : '';
      const tagText = isLocked
        ? I18nService.t('merchant.sealed')
        : (I18nService.getCurrentLanguage() === 'fr' ? 'CARTE DU DESTIN' : 'CARD OF DESTINY');
      const promptText = isLocked
        ? `🔒 ${I18nService.t('merchant.sealed')}`
        : `✦ ${I18nService.t('merchant.pick')} ✦`;
      const promptClass = isLocked ? 'card-mystery-prompt locked' : 'card-mystery-prompt';

      cardEl.innerHTML = `
        <div class="card-mystery-inner">
          <div class="card-mystery-rune" style="${runeStyle}">${runeText}</div>
          <div class="card-mystery-tag">${tagText}</div>
          <div class="card-mystery-num">${index === 0 ? 'I' : index === 1 ? 'II' : 'III'}</div>
          <div class="${promptClass}">${promptText}</div>
        </div>
      `;

      if (!isLocked) {
        cardEl.addEventListener('click', () => {
          // Double sécurité : on ne peut révéler qu'une seule carte
          if (merchant && !merchant.cards.some((c) => c.revealed) && !merchant.isClaimed) {
            card.revealed = true;
            this.render();
          }
        });
      }
      return cardEl;
    }

    // 2. CARTE RÉVÉLÉE (FACE DÉVOILÉE AVEC OBJET)
    const item = card.item;
    const trans = I18nService.getItemTranslation(item);
    const rarityColor = RARITY_COLORS[item.rarity] ?? '#ffffff';
    const rarityLabel = I18nService.getRarityLabel(item.rarity) || (RARITY_LABELS[item.rarity] ?? 'ITEM');

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
    iconCanvas.width = 36;
    iconCanvas.height = 36;
    ItemSpriteManager.renderToCanvas(iconCanvas, item);
    iconWrapper.appendChild(iconCanvas);
    headerEl.appendChild(iconWrapper);

    // Titre et Rareté
    const titleEl = document.createElement('div');
    titleEl.className = 'merchant-card-title';
    titleEl.textContent = trans.name.toUpperCase();
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
        const statLabel = I18nService.t(`hub.stat_${statDef.key}`) || statDef.label;
        row.innerHTML = `<span>${statLabel}</span><strong style="color: ${val > 0 ? '#4ade80' : '#f87171'}">${formatted}</strong>`;
        statsContainer.appendChild(row);
      }
    }
    if (hasStats) {
      cardEl.appendChild(statsContainer);
    }

    // Effet
    if (trans.effect && trans.effect.trim().length > 0) {
      const effectEl = document.createElement('div');
      effectEl.className = 'merchant-card-effect';
      effectEl.innerHTML = `<span style="color: #6ee7b7; font-weight: bold;">✦ ${I18nService.getCurrentLanguage() === 'fr' ? 'Effet' : 'Effect'} :</span> ${trans.effect}`;
      cardEl.appendChild(effectEl);
    }

    // Description
    if (trans.description && trans.description.trim().length > 0) {
      const descEl = document.createElement('div');
      descEl.className = 'merchant-card-desc';
      descEl.textContent = `« ${trans.description} »`;
      cardEl.appendChild(descEl);
    }

    // Actions au bas de la carte
    const actionsEl = document.createElement('div');
    actionsEl.className = 'merchant-card-actions';

    if (card.taken) {
      const takenBadge = document.createElement('div');
      takenBadge.className = 'merchant-badge-taken';
      takenBadge.textContent = I18nService.getCurrentLanguage() === 'fr' ? '👑 CHOISI & ÉQUIPÉ' : '👑 CHOSEN & EQUIPPED';
      actionsEl.appendChild(takenBadge);
    } else if (isMerchantClaimed) {
      const lockBadge = document.createElement('div');
      lockBadge.className = 'merchant-badge-locked';
      lockBadge.textContent = I18nService.getCurrentLanguage() === 'fr' ? '🔒 VERROUILLÉ' : '🔒 LOCKED';
      actionsEl.appendChild(lockBadge);
    } else {
      const takeBtn = document.createElement('button');
      takeBtn.type = 'button';
      takeBtn.className = 'merchant-btn merchant-btn-take';
      takeBtn.textContent = I18nService.t('btn.take');
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
      refuseBtn.textContent = card.refused
        ? (I18nService.getCurrentLanguage() === 'fr' ? 'REFUSÉ' : 'REFUSED')
        : (I18nService.getCurrentLanguage() === 'fr' ? 'REFUSER' : 'DECLINE');
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
}
