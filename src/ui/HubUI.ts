import hubBgUrl from '../assets/textures/hub.jpg';
import puzzleLordUrl from '../assets/sprites/player/puzzleLord/idle1.png';
import gouterLordUrl from '../assets/sprites/player/gouterLord/idle.png';
import { WalletManager } from '../core/WalletManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import {
  UpgradeManager,
  UPGRADE_DEFINITIONS,
  type UpgradeId,
} from '../core/UpgradeManager';
import { QuestManager } from '../core/QuestManager';
import { StashManager } from '../core/StashManager';
import { ItemDatabase } from '../config/ItemDatabase';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import { ItemTooltip } from './ItemTooltip';
import { FIREBALL_CONFIG } from '../config/constants';
import { GearScoreService } from '../core/GearScoreService';
import { NetworkClient } from '../network/NetworkClient';
import { SoundManager } from '../core/SoundManager';
import type { Player } from '../entities/Player';
import type { EquipmentItem, EquipmentSlot } from '../types';
import type { MatchFoundPayload, QueueStatusPayload } from '../types/network';

export type HubTab = 'play' | 'equipment' | 'shop' | 'quests';

interface SkinOption {
  id: string;
  name: string;
  title: string;
  url: string;
}

const SKINS: SkinOption[] = [
  {
    id: 'puzzle_lord',
    name: 'Lord Énigmatique',
    title: 'SEIGNEUR DES ARCANES',
    url: puzzleLordUrl,
  },
  {
    id: 'gouter_lord',
    name: 'Lord Gourmand',
    title: 'SEIGNEUR DES GÂTEAUX',
    url: gouterLordUrl,
  },
];

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  hat: 'CHAPEAU',
  weapon: 'ARME',
  armor: 'ARMURE',
  boots: 'BOTTES',
  key: 'CLÉ',
  offhand: 'MAIN GAUCHE',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#a8a29e',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
  artifact: '#ef4444',
};

export class HubUI {
  private readonly hubElement: HTMLElement | null;
  private readonly hubStage: HTMLElement | null;
  private readonly navTabs: NodeListOf<HTMLButtonElement>;
  private readonly views: Record<HubTab, HTMLElement | null>;
  private readonly coinIcon: HTMLImageElement | null;
  private readonly coinText: HTMLElement | null;
  private readonly menuBtn: HTMLButtonElement | null;
  private readonly launchGameBtn: HTMLButtonElement | null;

  // Éléments de l'avatar (panneau gauche)
  private readonly avatarImg: HTMLImageElement | null;
  private readonly avatarTitle: HTMLElement | null;
  private readonly skinName: HTMLElement | null;
  private readonly skinPrevBtn: HTMLButtonElement | null;
  private readonly skinNextBtn: HTMLButtonElement | null;
  private readonly avatarGearPreview: HTMLElement | null;
  private readonly avatarStats: HTMLElement | null;

  // Vues du contenu
  private readonly playStatsList: HTMLElement | null;
  private readonly playBodySlots: Partial<Record<EquipmentSlot, HTMLElement | null>> = {};
  private readonly equippedSlotsContainer: HTMLElement | null;
  private readonly stashListContainer: HTMLElement | null;
  private readonly fullStatsContainer: HTMLElement | null;
  private readonly upgradesListContainer: HTMLElement | null;
  private readonly shopItemsListContainer: HTMLElement | null;
  private readonly questsListContainer: HTMLElement | null;

  private currentSkinIndex = 0;
  private currentTab: HubTab = 'play';
  private player: Player | null = null;

  private onStartRaidCallback?: (options?: {
    seed?: number;
    spawnIndex?: number;
    instanceId?: string;
    localPlayerId?: string;
  }) => void;
  private onReturnToMenuCallback?: () => void;

  // Nouvelle interface de file d'attente Multijoueur
  private readonly queueOverlay: HTMLElement | null;
  private readonly queueTimerText: HTMLElement | null;
  private readonly queueStatusText: HTMLElement | null;
  private readonly queueRosterCount: HTMLElement | null;
  private readonly queueSlotsList: HTMLElement | null;
  private readonly queueCancelBtn: HTMLButtonElement | null;

  constructor(
    onStartRaid?: (options?: {
      seed?: number;
      spawnIndex?: number;
      instanceId?: string;
      localPlayerId?: string;
    }) => void,
    onReturnToMenu?: () => void
  ) {
    this.onStartRaidCallback = onStartRaid;
    this.onReturnToMenuCallback = onReturnToMenu;

    this.hubElement = document.getElementById('hub-menu');
    this.hubStage = document.getElementById('hub-stage');
    this.navTabs = document.querySelectorAll('.hub-nav-tab');
    this.coinIcon = document.getElementById('hub-coin-icon') as HTMLImageElement | null;
    this.coinText = document.getElementById('hub-coin-text');
    this.menuBtn = document.getElementById('hub-btn-menu') as HTMLButtonElement | null;
    this.launchGameBtn = document.getElementById('hub-launch-game-btn') as HTMLButtonElement | null;

    this.views = {
      play: document.getElementById('hub-view-play'),
      equipment: document.getElementById('hub-view-equipment'),
      shop: document.getElementById('hub-view-shop'),
      quests: document.getElementById('hub-view-quests'),
    };

    // Avatar
    this.avatarImg = document.getElementById('hub-avatar-img') as HTMLImageElement | null;
    this.avatarTitle = document.getElementById('hub-avatar-title');
    this.skinName = document.getElementById('hub-skin-name');
    this.skinPrevBtn = document.getElementById('hub-skin-prev') as HTMLButtonElement | null;
    this.skinNextBtn = document.getElementById('hub-skin-next') as HTMLButtonElement | null;
    this.avatarGearPreview = document.getElementById('hub-avatar-gear-preview');
    this.avatarStats = document.getElementById('hub-avatar-stats');

    // Équipement & Stats & Jouer
    this.playStatsList = document.getElementById('hub-play-stats-list');
    this.playBodySlots = {
      hat: document.getElementById('hub-play-slot-hat'),
      weapon: document.getElementById('hub-play-slot-weapon'),
      armor: document.getElementById('hub-play-slot-armor'),
      boots: document.getElementById('hub-play-slot-boots'),
      offhand: document.getElementById('hub-play-slot-offhand'),
    };
    this.equippedSlotsContainer = document.getElementById('hub-equipped-slots');
    this.stashListContainer = document.getElementById('hub-stash-list');
    this.fullStatsContainer = document.getElementById('hub-full-stats');

    // Boutique & Quêtes
    this.upgradesListContainer = document.getElementById('hub-upgrades-list');
    this.shopItemsListContainer = document.getElementById('hub-shop-items-list');
    this.questsListContainer = document.getElementById('hub-quests-list');

    // Nouvelle interface de file d'attente Multijoueur
    this.queueOverlay = document.getElementById('hub-queue-overlay');
    this.queueTimerText = document.getElementById('hub-queue-timer-text');
    this.queueStatusText = document.getElementById('hub-queue-status-text');
    this.queueRosterCount = document.getElementById('hub-queue-roster-count');
    this.queueSlotsList = document.getElementById('hub-queue-slots-list');
    this.queueCancelBtn = document.getElementById('hub-queue-cancel-btn') as HTMLButtonElement | null;

    // Initialisation du fond d'écran 16:9 dans la scène centrale (sans étirement ni zoom)
    const stageBg = `linear-gradient(rgba(10, 6, 18, 0.15), rgba(8, 4, 14, 0.4)), url('${hubBgUrl}')`;
    if (this.hubStage) {
      this.hubStage.style.backgroundImage = stageBg;
      this.hubStage.style.backgroundSize = '100% 100%';
      this.hubStage.style.backgroundPosition = 'center';
      this.hubStage.style.backgroundRepeat = 'no-repeat';
    }

    // Ambiance d'arrière-plan sur les bordures extérieures (écrans ultra-larges)
    if (this.hubElement) {
      this.hubElement.style.backgroundImage = `radial-gradient(circle at center, rgba(6, 4, 10, 0.7) 0%, rgba(6, 4, 10, 0.95) 100%), url('${hubBgUrl}')`;
      this.hubElement.style.backgroundSize = 'cover';
      this.hubElement.style.backgroundPosition = 'center';
      this.hubElement.style.backgroundRepeat = 'no-repeat';
    }

    if (this.coinIcon) {
      this.coinIcon.src = CoinSpriteManager.getCoinUrl();
    }

    // Chargement du skin sauvegardé
    const savedSkin = localStorage.getItem('raycaster_player_skin');
    if (savedSkin) {
      const idx = SKINS.findIndex((s) => s.id === savedSkin);
      if (idx >= 0) {
        this.currentSkinIndex = idx;
      }
    }

    this.setupEventListeners();
    this.setupNetworkListeners();
  }

  public setPlayer(player: Player): void {
    this.player = player;
    if (this.isVisible()) {
      this.renderPlayView();
      this.renderAvatar();
    }
  }

  public show(tab: HubTab = 'play'): void {
    if (!this.hubElement) {
      return;
    }

    UpgradeManager.init();
    QuestManager.init();
    StashManager.init();

    this.hubElement.classList.remove('hidden');
    this.hubElement.style.display = 'flex';
    this.updateWalletDisplay();
    this.switchTab(tab);
    this.renderAvatar();
  }

  public hide(): void {
    ItemTooltip.getInstance().hide();
    if (this.isQueueOpen()) {
      this.closeQueueScreen();
    }
    if (this.hubElement) {
      this.hubElement.classList.add('hidden');
      this.hubElement.style.display = 'none';
    }
  }

  public isVisible(): boolean {
    return Boolean(this.hubElement && !this.hubElement.classList.contains('hidden'));
  }

  public isQueueOpen(): boolean {
    return Boolean(this.queueOverlay && !this.queueOverlay.classList.contains('hidden'));
  }

  public openQueueScreen(): void {
    if (!this.player) return;
    const net = NetworkClient.getInstance();
    const playerName = SKINS[this.currentSkinIndex]?.name ?? 'Lord Aventurier';
    const skinId = SKINS[this.currentSkinIndex]?.id ?? 'puzzle_lord';
    const gearScore = this.player.getGearScore();

    // Inscription auprès du serveur de matchmaking
    net.joinQueue(playerName, gearScore, skinId);

    // Affichage de la nouvelle interface de file d'attente
    if (this.queueOverlay) {
      this.queueOverlay.classList.remove('hidden');
    }

    const lastStatus = net.getLastQueueStatus();
    const initialCountdown = lastStatus ? lastStatus.cycleCountdownSec : 60;

    if (this.queueTimerText) {
      this.queueTimerText.textContent = `${initialCountdown}s`;
    }
    if (this.queueRosterCount) {
      this.queueRosterCount.textContent = `1 / 4 PRÊTS`;
    }
    if (this.queueStatusText) {
      this.queueStatusText.textContent = `RECHERCHE D'AVENTURIERS EN COURS...`;
    }

    this.renderQueueSlots([
      { name: playerName, gearScore, skinId },
    ]);
  }

  public closeQueueScreen(): void {
    const net = NetworkClient.getInstance();
    net.leaveQueue();
    if (this.queueOverlay) {
      this.queueOverlay.classList.add('hidden');
    }
  }

  public getCurrentTab(): HubTab {
    return this.currentTab;
  }

  public switchTab(tab: HubTab): void {
    if (tab === 'shop' || tab === 'quests') {
      return;
    }
    ItemTooltip.getInstance().hide();
    this.currentTab = tab;

    // Mise à jour des boutons de navigation
    this.navTabs.forEach((btn) => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Affichage de la vue correspondante
    for (const [key, view] of Object.entries(this.views)) {
      if (key === tab) {
        view?.classList.remove('hidden');
        view?.classList.add('active');
      } else {
        view?.classList.add('hidden');
        view?.classList.remove('active');
      }
    }

    // Rendu spécifique de l'onglet actif
    if (tab === 'play') {
      this.renderPlayView();
    } else if (tab === 'equipment') {
      this.renderEquipmentView();
    } else if (tab === 'shop') {
      this.renderShopView();
    } else if (tab === 'quests') {
      this.renderQuestsView();
    }

    this.renderAvatar();
  }

  private setupEventListeners(): void {
    // Navigation par onglets
    this.navTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('hub-nav-tab-disabled') || btn.hasAttribute('disabled')) {
          return;
        }
        const tab = btn.getAttribute('data-tab') as HubTab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // Lancement de la partie -> Ouverture de l'interface de file d'attente (Multijoueur)
    this.launchGameBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ItemTooltip.getInstance().hide();
      this.openQueueScreen();
    });

    // Bouton d'annulation de la file d'attente
    this.queueCancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeQueueScreen();
    });

    // Annulation de la file avec Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isQueueOpen()) {
        e.preventDefault();
        e.stopPropagation();
        this.closeQueueScreen();
      }
    });

    // Retour au menu principal
    this.menuBtn?.addEventListener('click', () => {
      ItemTooltip.getInstance().hide();
      this.onReturnToMenuCallback?.();
    });

    // Changement de skin de l'avatar
    this.skinPrevBtn?.addEventListener('click', () => {
      this.currentSkinIndex = (this.currentSkinIndex - 1 + SKINS.length) % SKINS.length;
      this.saveSkin();
      this.renderAvatar();
    });

    this.skinNextBtn?.addEventListener('click', () => {
      this.currentSkinIndex = (this.currentSkinIndex + 1) % SKINS.length;
      this.saveSkin();
      this.renderAvatar();
    });

    // Infobulles d'objets suivant le curseur sur les équipements du menu Jouer
    const playSlots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];
    for (const slot of playSlots) {
      const slotEl = this.playBodySlots[slot];
      if (slotEl) {
        ItemTooltip.getInstance().attach(slotEl, () => this.player?.inventory.getItem(slot));
      }
    }

    // Écoute des variations du solde de pièces
    WalletManager.subscribe(() => {
      this.updateWalletDisplay();
    });
  }

  private setupNetworkListeners(): void {
    const net = NetworkClient.getInstance();

    net.onQueueStatus((status) => {
      this.updateQueueStatusUI(status);
    });

    net.onMatchFound((data) => {
      this.showMatchFoundNotification(data);
    });

    net.onMatchStart((data) => {
      ItemTooltip.getInstance().hide();
      if (this.queueOverlay) {
        this.queueOverlay.classList.add('hidden');
      }
      const localPlayer = data.players[data.playerIndex];
      this.onStartRaidCallback?.({
        seed: data.mapSeed,
        spawnIndex: data.spawnIndex,
        instanceId: data.instanceId,
        localPlayerId: localPlayer?.id,
      });
    });
  }

  private updateQueueStatusUI(status: QueueStatusPayload): void {
    if (this.queueTimerText) {
      this.queueTimerText.textContent = `${status.cycleCountdownSec}s`;
    }
    if (this.queueRosterCount) {
      this.queueRosterCount.textContent = `${status.queuedCount} / ${status.maxPlayers} PRÊTS`;
    }
    if (this.queueStatusText) {
      if (status.cycleCountdownSec <= 5) {
        this.queueStatusText.textContent = `⚡ DÉPART IMMINENT DU CONVOI !`;
      } else {
        this.queueStatusText.textContent = `RECHERCHE D'AVENTURIERS EN COURS...`;
      }
    }

    if (this.isQueueOpen()) {
      this.renderQueueSlots(status.queuedPlayers);
    }
  }

  private renderQueueSlots(
    queuedPlayers: Array<{ name: string; gearScore: number; skinId?: string }>
  ): void {
    if (!this.queueSlotsList) return;
    this.queueSlotsList.innerHTML = '';

    const maxSlots = 4;
    const currentSkin = SKINS[this.currentSkinIndex];

    for (let i = 0; i < maxSlots; i++) {
      const p = queuedPlayers[i];
      const slotCard = document.createElement('div');

      if (p) {
        const matchedSkin = SKINS.find((s) => s.id === p.skinId) ?? currentSkin;
        const avatarUrl = matchedSkin?.url ?? puzzleLordUrl;
        const isLocal = i === 0 || p.name === currentSkin?.name;

        slotCard.className = `hub-queue-player-card${isLocal ? ' is-local' : ''}`;
        slotCard.innerHTML = `
          <img src="${avatarUrl}" class="hub-queue-card-avatar" alt="${p.name}" />
          <div class="hub-queue-card-name">${p.name}${isLocal ? ' (Vous)' : ''}</div>
          <div class="hub-queue-card-gs">⭐ ${p.gearScore} GS</div>
          <div class="hub-queue-card-status">✅ PRÊT</div>
        `;
      } else {
        slotCard.className = 'hub-queue-player-card empty-slot';
        slotCard.innerHTML = `
          <div class="hub-queue-empty-icon">⏳</div>
          <div class="hub-queue-empty-text">Emplacement libre #${i + 1}</div>
        `;
      }

      this.queueSlotsList.appendChild(slotCard);
    }
  }

  private showMatchFoundNotification(data: MatchFoundPayload): void {
    if (this.isQueueOpen()) {
      if (this.queueStatusText) {
        this.queueStatusText.textContent = `⚔️ CONVOI EN ROUTE ! Téléportation dans ${data.countdownSec}s...`;
      }
      if (this.queueTimerText) {
        this.queueTimerText.textContent = `${data.countdownSec}s`;
      }
    }

    const existing = document.querySelector('.hub-match-found-banner');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'hub-match-found-banner';
    toast.innerHTML = `
      <div class="hub-mf-title">⚔️ CONVOI EN ROUTE !</div>
      <div class="hub-mf-desc">Téléportation vers la Citadelle dans <strong>${data.countdownSec}s</strong></div>
      <div class="hub-mf-crypt">Crypte assignée : Angle #${data.spawnIndex + 1} (${data.totalPlayers} aventurier(s))</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, (data.countdownSec + 1) * 1000);
  }

  private saveSkin(): void {
    const skin = SKINS[this.currentSkinIndex];
    if (skin) {
      localStorage.setItem('raycaster_player_skin', skin.id);
    }
  }

  private updateWalletDisplay(): void {
    if (this.coinText) {
      this.coinText.textContent = String(WalletManager.getCoins());
    }
  }

  // =========================================================================
  // PANNEAU GAUCHE : APERÇU DE L'AVATAR & STATS RAPIDES
  // =========================================================================
  private renderAvatar(): void {
    const skin = SKINS[this.currentSkinIndex];
    if (skin) {
      if (this.avatarImg) this.avatarImg.src = skin.url;
      if (this.avatarTitle) this.avatarTitle.textContent = skin.title;
      if (this.skinName) this.skinName.textContent = skin.name;
    }

    if (!this.player) {
      return;
    }

    // 1. Mini aperçu des objets équipés sous forme d'icônes
    if (this.avatarGearPreview) {
      this.avatarGearPreview.innerHTML = '';
      const slots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];
      for (const slot of slots) {
        const item = this.player.inventory.getItem(slot);
        const slotEl = document.createElement('div');
        slotEl.className = `hub-gear-mini-slot ${item ? item.rarity : 'empty'}`;
        slotEl.title = item ? `${item.name} (${SLOT_LABELS[slot]})` : `${SLOT_LABELS[slot]} (Vide)`;

        if (item) {
          const iconUrl = ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id);
          if (iconUrl) {
            slotEl.innerHTML = `<img src="${iconUrl}" alt="" class="hub-gear-mini-icon" />`;
          } else {
            slotEl.textContent = SLOT_LABELS[slot][0];
          }
        } else {
          slotEl.innerHTML = `<span class="hub-gear-empty-marker">+</span>`;
        }

        this.avatarGearPreview.appendChild(slotEl);
      }
    }

    // 2. Statistiques effectives du joueur
    if (this.avatarStats) {
      const stats = this.player.getEffectiveStats();
      const speedPct = Math.round(stats.moveSpeed * 100);
      const castPct = Math.round(stats.castSpeed * 100);

      this.avatarStats.innerHTML = `
        <div class="hub-stat-row">
          <span class="hub-stat-label">⭐ PUISSANCE</span>
          <span class="hub-stat-val font-yellow font-bold">${this.player.getGearScore()}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">❤️ PV MAX</span>
          <span class="hub-stat-val font-green">${this.player.maxHealth}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">🗡️ DÉGÂTS</span>
          <span class="hub-stat-val font-red">${FIREBALL_CONFIG.DAMAGE + stats.damage + stats.magicPower}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">🛡️ DÉFENSE</span>
          <span class="hub-stat-val font-blue">${stats.defense}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">💨 VITESSE</span>
          <span class="hub-stat-val font-yellow">${speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">⚡ INCANTATION</span>
          <span class="hub-stat-val font-purple">${castPct >= 0 ? `+${castPct}%` : `${castPct}%`}</span>
        </div>
      `;
    }
  }

  // =========================================================================
  // VUE 1 : JOUER (ÉQUIPEMENT ANATOMIQUE À GAUCHE & STATS VERTICALES À DROITE)
  // =========================================================================
  private renderPlayView(): void {
    if (!this.player) return;

    // 1. Équipement arrangé selon le placement sur le corps (Paperdoll à gauche)
    const slots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];
    const slotPlaceholders: Record<EquipmentSlot, string> = {
      hat: '🎩',
      weapon: '⚔️',
      armor: '🥋',
      boots: '👢',
      key: '🔑',
      offhand: '🔮',
    };

    for (const slot of slots) {
      const container = this.playBodySlots[slot];
      if (!container) continue;

      const item = this.player.inventory.getItem(slot);
      const iconUrl = item ? ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id) : null;
      const rarityClass = item ? `rarity-${item.rarity}` : 'empty';

      container.className = `hub-play-body-slot slot-${slot} ${rarityClass}`;
      container.title = '';
      container.innerHTML = `
        <div class="hub-body-slot-badge">${SLOT_LABELS[slot]}</div>
        <div class="hub-body-slot-icon-box">
          ${iconUrl ? `<img src="${iconUrl}" class="hub-body-slot-img" alt="" />` : `<span class="hub-body-slot-placeholder">${slotPlaceholders[slot]}</span>`}
        </div>
        <div class="hub-body-slot-info">
          <div class="hub-body-slot-name" style="color: ${item ? RARITY_COLORS[item.rarity] : '#64748b'}">
            ${item ? item.name : 'Emplacement libre'}
          </div>
          <div class="hub-body-slot-stats">
            ${item ? this.formatItemStats(item) : 'Aucun bonus direct'}
          </div>
        </div>
      `;

      container.onclick = () => {
        ItemTooltip.getInstance().hide();
        this.switchTab('equipment');
      };
    }

    // 2. Statistiques en liste verticale (à droite)
    if (this.playStatsList) {
      const stats = this.player.getEffectiveStats();
      const speedPct = Math.round(stats.moveSpeed * 100);
      const castPct = Math.round(stats.castSpeed * 100);
      const totalDamage = FIREBALL_CONFIG.DAMAGE + stats.damage + stats.magicPower;

      const statItems = [
        {
          icon: '⭐',
          label: 'PUISSANCE TOTALE (GEAR SCORE)',
          desc: 'Score global d\'équipement & niveau de la citadelle',
          value: `${this.player.getGearScore()}`,
          colorClass: 'font-yellow font-bold',
        },
        {
          icon: '❤️',
          label: 'POINTS DE VIE MAX',
          desc: 'Endurance vitale face aux périls',
          value: `${this.player.maxHealth} PV`,
          colorClass: 'font-green',
        },
        {
          icon: '🔮',
          label: 'DÉGÂTS DES SORTS',
          desc: 'Puissance offensive brute des arcanes',
          value: `${totalDamage}`,
          colorClass: 'font-red',
        },
        {
          icon: '🛡️',
          label: 'DÉFENSE / ARMURE',
          desc: 'Réduction directe des dégâts subis',
          value: `${stats.defense}`,
          colorClass: 'font-blue',
        },
        {
          icon: '💨',
          label: 'VITESSE DE COURSE',
          desc: 'Agilité de déplacement et d\'esquive',
          value: speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`,
          colorClass: 'font-yellow',
        },
        {
          icon: '⚡',
          label: 'CADENCE D\'INCANTATION',
          desc: 'Vitesse de récupération magique',
          value: castPct >= 0 ? `+${castPct}%` : `${castPct}%`,
          colorClass: 'font-purple',
        },
      ];

      this.playStatsList.innerHTML = statItems
        .map(
          (s) => `
          <div class="hub-stat-vrow">
            <div class="hub-stat-vicon">${s.icon}</div>
            <div class="hub-stat-vmeta">
              <span class="hub-stat-vlabel">${s.label}</span>
              <span class="hub-stat-vdesc">${s.desc}</span>
            </div>
            <div class="hub-stat-vval ${s.colorClass}">${s.value}</div>
          </div>
        `
        )
        .join('');
    }
  }

  // =========================================================================
  // VUE 2 : ÉQUIPEMENT & RÉSERVE (STASH)
  // =========================================================================
  private renderEquipmentView(): void {
    if (!this.player) return;

    // 1. Objets équipés (Paperdoll)
    if (this.equippedSlotsContainer) {
      this.equippedSlotsContainer.innerHTML = '';
      const slots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];

      for (const slot of slots) {
        const item = this.player.inventory.getItem(slot);
        const card = document.createElement('div');
        card.className = `hub-equip-slot-card ${item ? `rarity-${item.rarity}` : 'empty'}`;

        const iconUrl = item ? ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id) : null;

        card.innerHTML = `
          <div class="hub-slot-badge">${SLOT_LABELS[slot]}</div>
          <div class="hub-slot-icon-box">
            ${iconUrl ? `<img src="${iconUrl}" class="hub-slot-img" alt="" />` : `<span class="hub-empty-slot-text">VIDE</span>`}
          </div>
          <div class="hub-slot-info">
            <div class="hub-slot-item-name" style="color: ${item ? RARITY_COLORS[item.rarity] : '#64748b'}">
              ${item ? item.name : 'Emplacement libre'}
            </div>
            ${item ? `<div class="hub-slot-stat-summary">${this.formatItemStats(item)}</div>` : ''}
          </div>
          ${item ? `<button class="hub-unequip-btn" type="button" title="Déséquiper vers la réserve">RETIRER</button>` : ''}
        `;

        if (item) {
          ItemTooltip.getInstance().attach(card, () => this.player?.inventory.getItem(slot));
          const unequipBtn = card.querySelector('.hub-unequip-btn');
          unequipBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            ItemTooltip.getInstance().hide();
            const removed = this.player?.inventory.unequip(slot);
            if (removed) {
              SoundManager.play2D('equipItem', { volume: 0.75 });
              StashManager.addItem(removed);
              this.renderEquipmentView();
              this.renderPlayView();
              this.renderAvatar();
            }
          });
        }

        this.equippedSlotsContainer.appendChild(card);
      }
    }

    // 2. Réserve d'objets (Stash)
    if (this.stashListContainer) {
      this.stashListContainer.innerHTML = '';
      const stash = StashManager.getStash();

      if (stash.length === 0) {
        this.stashListContainer.innerHTML = `
          <div class="hub-stash-empty">
            <p>Votre réserve est vide.</p>
            <p class="hub-stash-empty-hint">Sécurisez des objets lors de vos expéditions ou visitez la Boutique pour en acheter !</p>
          </div>
        `;
      } else {
        for (const item of stash) {
          const itemCard = document.createElement('div');
          itemCard.className = `hub-stash-card rarity-${item.rarity}`;
          const iconUrl = ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id);

          itemCard.innerHTML = `
            <div class="hub-stash-card-icon">
              ${iconUrl ? `<img src="${iconUrl}" class="hub-stash-img" alt="" />` : ''}
            </div>
            <div class="hub-stash-card-content">
              <div class="hub-stash-item-name" style="color: ${RARITY_COLORS[item.rarity]}">${item.name}</div>
              <div class="hub-stash-item-type">${SLOT_LABELS[item.slot]} • ${item.rarity.toUpperCase()}</div>
              <div class="hub-stash-stats">${this.formatItemStats(item)}</div>
            </div>
            <button class="hub-equip-btn" type="button">ÉQUIPER</button>
          `;

          ItemTooltip.getInstance().attach(
            itemCard,
            () => item,
            () => this.player?.inventory.getItem(item.slot)
          );

          const equipBtn = itemCard.querySelector('.hub-equip-btn');
          equipBtn?.addEventListener('click', () => {
            ItemTooltip.getInstance().hide();
            const removed = StashManager.removeItem(item.id);
            if (removed && this.player) {
              SoundManager.play2D('equipItem', { volume: 0.75 });
              const previous = this.player.pickupItem(removed);
              if (previous) {
                StashManager.addItem(previous);
              }
              this.renderEquipmentView();
              this.renderPlayView();
              this.renderAvatar();
            }
          });

          this.stashListContainer.appendChild(itemCard);
        }
      }
    }

    // 3. Fiche détaillée des caractéristiques
    if (this.fullStatsContainer) {
      const gear = this.player.inventory.getTotalStats();
      const upg = UpgradeManager.getStats();
      const total = this.player.getEffectiveStats();

      this.fullStatsContainer.innerHTML = `
        <div class="hub-stats-table">
          <div class="hub-stats-table-row header">
            <span>STATISTIQUE</span>
            <span>BASE</span>
            <span>OBJETS</span>
            <span>TALENTS</span>
            <span>TOTAL</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Points de Vie (PV)</span>
            <span>100</span>
            <span class="font-green">+${gear.maxHealth}</span>
            <span class="font-green">+${upg.maxHealth}</span>
            <span class="font-green font-bold">${100 + total.maxHealth}</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Dégâts Magiques</span>
            <span>${FIREBALL_CONFIG.DAMAGE}</span>
            <span class="font-red">+${gear.damage}</span>
            <span class="font-red">+${upg.damage}</span>
            <span class="font-red font-bold">${FIREBALL_CONFIG.DAMAGE + total.damage}</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Armure / Défense</span>
            <span>0</span>
            <span class="font-blue">+${gear.defense}</span>
            <span class="font-blue">+${upg.defense}</span>
            <span class="font-blue font-bold">${total.defense}</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Vitesse de Déplacement</span>
            <span>100%</span>
            <span class="font-yellow">+${Math.round(gear.moveSpeed * 100)}%</span>
            <span class="font-yellow">+${Math.round(upg.moveSpeed * 100)}%</span>
            <span class="font-yellow font-bold">${100 + Math.round(total.moveSpeed * 100)}%</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Vitesse d'Incantation</span>
            <span>100%</span>
            <span class="font-purple">+${Math.round(gear.castSpeed * 100)}%</span>
            <span class="font-purple">+${Math.round(upg.castSpeed * 100)}%</span>
            <span class="font-purple font-bold">${100 + Math.round(total.castSpeed * 100)}%</span>
          </div>
          <div class="hub-stats-table-row">
            <span>Puissance Mystique</span>
            <span>0</span>
            <span class="font-purple">+${gear.magicPower}</span>
            <span class="font-purple">+${upg.magicPower}</span>
            <span class="font-purple font-bold">${total.magicPower}</span>
          </div>
        </div>
      `;
    }
  }

  // =========================================================================
  // VUE 3 : BOUTIQUE (AMÉLIORATIONS ET ARSENAL)
  // =========================================================================
  private renderShopView(): void {
    const currentCoins = WalletManager.getCoins();

    // 1. Améliorations permanentes
    if (this.upgradesListContainer) {
      this.upgradesListContainer.innerHTML = '';
      const upgradeIds: UpgradeId[] = ['vitality', 'power', 'defense', 'speed', 'casting'];

      for (const id of upgradeIds) {
        const def = UPGRADE_DEFINITIONS[id];
        const level = UpgradeManager.getLevel(id);
        const cost = UpgradeManager.getCost(id);
        const isMaxed = level >= def.maxLevel;
        const canAfford = cost !== null && currentCoins >= cost;

        const card = document.createElement('div');
        card.className = `hub-upgrade-card ${isMaxed ? 'maxed' : ''}`;

        // Rendu des étoiles de niveau [★★★☆☆]
        let stars = '';
        for (let i = 0; i < def.maxLevel; i++) {
          stars += i < level ? '★' : '☆';
        }

        card.innerHTML = `
          <div class="hub-upgrade-icon">${def.icon}</div>
          <div class="hub-upgrade-details">
            <div class="hub-upgrade-title-row">
              <span class="hub-upgrade-name">${def.name}</span>
              <span class="hub-upgrade-level ${isMaxed ? 'font-yellow' : ''}">${stars} Rang ${level}/${def.maxLevel}</span>
            </div>
            <p class="hub-upgrade-desc">${def.description}</p>
            <div class="hub-upgrade-effect font-green">✦ ${def.statEffect}</div>
          </div>
          <div class="hub-upgrade-action">
            ${
              isMaxed
                ? `<span class="hub-badge-maxed">MAXIMISÉ</span>`
                : `<button class="hub-buy-btn ${canAfford ? '' : 'disabled'}" type="button">
                    AMÉLIORER<br><span class="hub-cost-tag">${cost} 🪙</span>
                   </button>`
            }
          </div>
        `;

        if (!isMaxed) {
          const buyBtn = card.querySelector('.hub-buy-btn');
          buyBtn?.addEventListener('click', () => {
            if (UpgradeManager.buy(id)) {
              this.updateWalletDisplay();
              this.renderShopView();
              this.renderPlayView();
              this.renderAvatar();
            }
          });
        }

        this.upgradesListContainer.appendChild(card);
      }
    }

    // 2. Arsenal en vente dans la boutique
    if (this.shopItemsListContainer) {
      this.shopItemsListContainer.innerHTML = '';
      // 4 objets d'exception de la base de données
      const curatedItemIds = [
        'weapon_arthritic_lich_staff',
        'hat_myopic_necromancer',
        'armor_moldy_hermit_rags',
        'weapon_crooked_phylactery_dagger',
      ];

      for (const itemId of curatedItemIds) {
        const item = ItemDatabase.getItemById(itemId);
        if (!item) continue;

        // Prix selon la rareté
        const priceMap: Record<string, number> = {
          common: 20,
          uncommon: 35,
          rare: 55,
          epic: 80,
          legendary: 120,
          artifact: 160,
        };
        const price = priceMap[item.rarity] ?? 50;
        const canAfford = currentCoins >= price;
        const iconUrl = ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id);

        const card = document.createElement('div');
        card.className = `hub-shop-item-card rarity-${item.rarity}`;

        card.innerHTML = `
          <div class="hub-shop-item-icon-box">
            ${iconUrl ? `<img src="${iconUrl}" class="hub-shop-item-img" alt="" />` : ''}
          </div>
          <div class="hub-shop-item-info">
            <div class="hub-shop-item-name" style="color: ${RARITY_COLORS[item.rarity]}">${item.name}</div>
            <div class="hub-shop-item-type">${SLOT_LABELS[item.slot]} • ${item.rarity.toUpperCase()}</div>
            <div class="hub-shop-item-stats">${this.formatItemStats(item)}</div>
            ${item.effect ? `<div class="hub-shop-item-effect">« ${item.effect} »</div>` : ''}
          </div>
          <div class="hub-shop-item-action">
            <button class="hub-buy-item-btn ${canAfford ? '' : 'disabled'}" type="button">
              ACHETER<br><span class="hub-cost-tag">${price} 🪙</span>
            </button>
          </div>
        `;

        const buyBtn = card.querySelector('.hub-buy-item-btn');
        buyBtn?.addEventListener('click', () => {
          if (WalletManager.spendCoins(price)) {
            StashManager.addItem(item);
            this.updateWalletDisplay();
            this.renderShopView();
          }
        });

        this.shopItemsListContainer.appendChild(card);
      }
    }
  }

  // =========================================================================
  // VUE 4 : QUÊTES & CONTRATS
  // =========================================================================
  private renderQuestsView(): void {
    if (!this.questsListContainer) return;

    this.questsListContainer.innerHTML = '';
    const quests = QuestManager.getQuests();

    for (const q of quests) {
      const card = document.createElement('div');
      card.className = `hub-quest-card ${q.completed ? 'completed' : ''} ${q.claimed ? 'claimed' : ''}`;

      const progressPct = Math.min(100, Math.round((q.current / q.target) * 100));

      card.innerHTML = `
        <div class="hub-quest-icon">${q.icon}</div>
        <div class="hub-quest-details">
          <div class="hub-quest-title-row">
            <span class="hub-quest-title">${q.title}</span>
            <span class="hub-quest-progress-text">${q.current} / ${q.target}</span>
          </div>
          <p class="hub-quest-desc">${q.description}</p>
          <div class="hub-quest-bar-track">
            <div class="hub-quest-bar-fill" style="width: ${progressPct}%"></div>
          </div>
        </div>
        <div class="hub-quest-action">
          <div class="hub-quest-reward font-yellow">+${q.rewardCoins} 🪙</div>
          ${
            q.claimed
              ? `<span class="hub-quest-status claimed">ACCOMPLIE</span>`
              : q.completed
              ? `<button class="hub-claim-btn" type="button">RÉCLAMER !</button>`
              : `<span class="hub-quest-status pending">EN COURS</span>`
          }
        </div>
      `;

      if (q.completed && !q.claimed) {
        const claimBtn = card.querySelector('.hub-claim-btn');
        claimBtn?.addEventListener('click', () => {
          if (QuestManager.claim(q.id)) {
            this.updateWalletDisplay();
            this.renderQuestsView();
          }
        });
      }

      this.questsListContainer.appendChild(card);
    }
  }

  private formatItemStats(item: EquipmentItem): string {
    const parts: string[] = [];
    const gs = item.gearScore ?? GearScoreService.calculateItemGearScore(item);
    parts.push(`⭐ ${gs}`);
    if (item.stats.maxHealth) parts.push(`+${item.stats.maxHealth} PV`);
    if (item.stats.damage) parts.push(`+${item.stats.damage} Dégâts`);
    if (item.stats.defense) parts.push(`+${item.stats.defense} Déf`);
    if (item.stats.magicPower) parts.push(`+${item.stats.magicPower} Magie`);
    if (item.stats.moveSpeed) parts.push(`+${Math.round(item.stats.moveSpeed * 100)}% Vit`);
    if (item.stats.castSpeed) parts.push(`+${Math.round(item.stats.castSpeed * 100)}% Incant`);
    return parts.length > 0 ? parts.join(' • ') : 'Aucun bonus direct';
  }
}
