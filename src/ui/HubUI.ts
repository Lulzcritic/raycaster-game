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
import { AuthManager } from '../core/AuthManager';
import { I18nService, type Language } from '../core/I18nService';
import type { Player } from '../entities/Player';
import type { EquipmentItem, EquipmentSlot } from '../types';
import type { MatchFoundPayload, QueueStatusPayload } from '../types/network';

export type HubTab = 'play' | 'equipment' | 'shop' | 'quests' | 'ladder';

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
  private readonly upgradesListContainer: HTMLElement | null;
  private readonly shopItemsListContainer: HTMLElement | null;
  private readonly questsListContainer: HTMLElement | null;
  private readonly ladderTbody: HTMLElement | null;
  private readonly ladderRefreshBtn: HTMLButtonElement | null;
  private readonly ladderCurrentUserCard: HTMLElement | null;
  private isLadderLoading = false;

  private currentSkinIndex = 0;
  private currentTab: HubTab = 'play';
  private player: Player | null = null;
  private localQueuePlayerName = '';

  private onStartRaidCallback?: (options?: {
    seed?: number;
    spawnIndex?: number;
    instanceId?: string;
    localPlayerId?: string;
  }) => void;
  private onReturnToMenuCallback?: () => void;
  private onOpenSettingsCallback?: () => void;

  // Contrôles audio, paramètres et langue du Hub
  private readonly hubMusicBtn: HTMLButtonElement | null;
  private readonly hubMusicIcon: HTMLElement | null;
  private readonly hubSfxBtn: HTMLButtonElement | null;
  private readonly hubSfxIcon: HTMLElement | null;
  private readonly hubSettingsBtn: HTMLButtonElement | null;
  private readonly hubLangBtn: HTMLButtonElement | null;
  private readonly hubLangBadge: HTMLElement | null;
  private unsubscribeAudio?: () => void;
  private unsubscribeLanguage?: () => void;

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
    onReturnToMenu?: () => void,
    onOpenSettings?: () => void
  ) {
    this.onStartRaidCallback = onStartRaid;
    this.onReturnToMenuCallback = onReturnToMenu;
    this.onOpenSettingsCallback = onOpenSettings;

    this.hubElement = document.getElementById('hub-menu');
    this.hubStage = document.getElementById('hub-stage');
    this.navTabs = document.querySelectorAll('.hub-nav-tab');
    this.coinIcon = document.getElementById('hub-coin-icon') as HTMLImageElement | null;
    this.coinText = document.getElementById('hub-coin-text');
    this.menuBtn = document.getElementById('hub-btn-menu') as HTMLButtonElement | null;
    this.launchGameBtn = document.getElementById('hub-launch-game-btn') as HTMLButtonElement | null;

    // Contrôles Audio, Paramètres et Langue
    this.hubMusicBtn = document.getElementById('hub-music-btn') as HTMLButtonElement | null;
    this.hubMusicIcon = document.getElementById('hub-music-icon');
    this.hubSfxBtn = document.getElementById('hub-sfx-btn') as HTMLButtonElement | null;
    this.hubSfxIcon = document.getElementById('hub-sfx-icon');
    this.hubSettingsBtn = document.getElementById('hub-btn-settings') as HTMLButtonElement | null;
    this.hubLangBtn = document.getElementById('hub-lang-btn') as HTMLButtonElement | null;
    this.hubLangBadge = document.getElementById('hub-lang-badge');

    this.views = {
      play: document.getElementById('hub-view-play'),
      equipment: document.getElementById('hub-view-equipment'),
      ladder: document.getElementById('hub-view-ladder'),
      shop: document.getElementById('hub-view-shop'),
      quests: document.getElementById('hub-view-quests'),
    };

    this.ladderTbody = document.getElementById('hub-ladder-tbody');
    this.ladderRefreshBtn = document.getElementById('hub-ladder-refresh-btn') as HTMLButtonElement | null;
    this.ladderCurrentUserCard = document.getElementById('hub-ladder-current-user-card');

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

  /**
   * Retourne le nom à afficher et à inscrire dans la file de matchmaking.
   * Si le joueur est connecté, son pseudonyme de compte est prioritaire.
   */
  public getQueuePlayerName(): string {
    const currentUser = AuthManager.getUser();
    if (AuthManager.isLoggedIn() && currentUser?.username) {
      return currentUser.username;
    }
    return SKINS[this.currentSkinIndex]?.name ?? 'Lord Aventurier';
  }

  public openQueueScreen(): void {
    if (!this.player) return;
    const net = NetworkClient.getInstance();
    const playerName = this.getQueuePlayerName();
    const skinId = SKINS[this.currentSkinIndex]?.id ?? 'puzzle_lord';
    const gearScore = this.player.getGearScore();

    this.localQueuePlayerName = playerName;

    // Inscription auprès du serveur de matchmaking avec le pseudonyme du joueur
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
    this.localQueuePlayerName = '';
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
    } else if (tab === 'ladder') {
      this.renderLadderView();
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

    // Bouton de rafraîchissement du Ladder
    this.ladderRefreshBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.renderLadderView();
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

    // Contrôles audio du Hub
    this.hubMusicBtn?.addEventListener('click', () => {
      SoundManager.toggleMusicMute();
      this.updateAudioButtons();
      SoundManager.playButtonSound();
    });

    this.hubSfxBtn?.addEventListener('click', () => {
      const isMuted = SoundManager.toggleSfxMute();
      this.updateAudioButtons();
      if (!isMuted) {
        SoundManager.playButtonSound();
      }
    });

    // Bouton Changement Rapide de Langue du Hub
    this.hubLangBtn?.addEventListener('click', () => {
      I18nService.toggleLanguage();
      SoundManager.playButtonSound();
    });

    // Abonnement aux changements de langue
    this.unsubscribeLanguage = I18nService.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });

    // Bouton Paramètres du Hub
    this.hubSettingsBtn?.addEventListener('click', () => {
      SoundManager.playButtonSound();
      this.onOpenSettingsCallback?.();
    });

    // Abonnement aux changements d'état muet audio
    this.unsubscribeAudio = SoundManager.subscribeMute(() => {
      this.updateAudioButtons();
    });
    this.updateAudioButtons();
  }

  public destroy(): void {
    this.unsubscribeAudio?.();
    this.unsubscribeLanguage?.();
  }

  public updateLanguageDisplay(lang: Language): void {
    if (this.hubLangBadge) {
      this.hubLangBadge.textContent = lang.toUpperCase();
    }
    this.renderAvatar();
    if (this.isVisible()) {
      if (this.currentTab === 'play') this.renderPlayView();
      else if (this.currentTab === 'equipment') this.renderEquipmentView();
      else if (this.currentTab === 'ladder') this.renderLadderView();
      else if (this.currentTab === 'shop') this.renderShopView();
      else if (this.currentTab === 'quests') this.renderQuestsView();
    }
    I18nService.translateDOM(this.hubElement ?? document);
  }

  public updateAudioButtons(): void {
    const isMusicMuted = SoundManager.isMusicMute();
    const isSfxMuted = SoundManager.isSfxMute();
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (this.hubMusicIcon) {
      this.hubMusicIcon.textContent = isMusicMuted ? '🔇' : '🎵';
    }
    if (this.hubMusicBtn) {
      this.hubMusicBtn.title = isMusicMuted
        ? (isFr ? 'Activer la musique' : 'Unmute music')
        : (isFr ? 'Couper la musique' : 'Mute music');
      this.hubMusicBtn.classList.toggle('is-muted', isMusicMuted);
    }

    if (this.hubSfxIcon) {
      this.hubSfxIcon.textContent = isSfxMuted ? '🔇' : '🔊';
    }
    if (this.hubSfxBtn) {
      this.hubSfxBtn.title = isSfxMuted
        ? (isFr ? 'Activer les effets sonores' : 'Unmute sound effects')
        : (isFr ? 'Couper les effets sonores' : 'Mute sound effects');
      this.hubSfxBtn.classList.toggle('is-muted', isSfxMuted);
    }
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
    const isFr = I18nService.getCurrentLanguage() === 'fr';
    if (this.queueTimerText) {
      this.queueTimerText.textContent = `${status.cycleCountdownSec}s`;
    }
    if (this.queueRosterCount) {
      this.queueRosterCount.textContent = `${status.queuedCount} / ${status.maxPlayers} ${isFr ? 'PRÊTS' : 'READY'}`;
    }
    if (this.queueStatusText) {
      if (status.cycleCountdownSec <= 5) {
        this.queueStatusText.textContent = isFr
          ? `⚡ DÉPART IMMINENT DU CONVOI !`
          : `⚡ CONVOY DEPARTURE IMMINENT!`;
      } else {
        this.queueStatusText.textContent = isFr
          ? `RECHERCHE D'AVENTURIERS EN COURS...`
          : `SEARCHING FOR ADVENTURERS...`;
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

    const isFr = I18nService.getCurrentLanguage() === 'fr';
    const maxSlots = 4;
    const currentSkin = SKINS[this.currentSkinIndex];
    const localExpectedName = this.localQueuePlayerName || this.getQueuePlayerName();

    for (let i = 0; i < maxSlots; i++) {
      const p = queuedPlayers[i];
      const slotCard = document.createElement('div');

      if (p) {
        const matchedSkin = SKINS.find((s) => s.id === p.skinId) ?? currentSkin;
        const avatarUrl = matchedSkin?.url ?? puzzleLordUrl;
        const isLocal = p.name === localExpectedName || (i === 0 && !queuedPlayers.some((other) => other.name === localExpectedName));
        const skinName = I18nService.t(`skin.${matchedSkin?.id}.name`) || matchedSkin?.name || '';

        slotCard.className = `hub-queue-player-card${isLocal ? ' is-local' : ''}`;
        slotCard.innerHTML = `
          <img src="${avatarUrl}" class="hub-queue-card-avatar" alt="${p.name}" />
          <div class="hub-queue-card-name" title="${p.name}">${p.name}${isLocal ? (isFr ? ' (Vous)' : ' (You)') : ''}</div>
          <div class="hub-queue-card-skin" style="font-size: 10px; color: #94a3b8; margin-top: -2px;">${skinName}</div>
          <div class="hub-queue-card-gs">⭐ ${p.gearScore} GS</div>
          <div class="hub-queue-card-status">✅ ${isFr ? 'PRÊT' : 'READY'}</div>
        `;
      } else {
        slotCard.className = 'hub-queue-player-card empty-slot';
        slotCard.innerHTML = `
          <div class="hub-queue-empty-icon">⏳</div>
          <div class="hub-queue-empty-text">${isFr ? 'Emplacement libre #' : 'Open slot #'}${i + 1}</div>
        `;
      }

      this.queueSlotsList.appendChild(slotCard);
    }
  }

  private showMatchFoundNotification(data: MatchFoundPayload): void {
    const isFr = I18nService.getCurrentLanguage() === 'fr';
    if (this.isQueueOpen()) {
      if (this.queueStatusText) {
        this.queueStatusText.textContent = isFr
          ? `⚔️ CONVOI EN ROUTE ! Téléportation dans ${data.countdownSec}s...`
          : `⚔️ CONVOY EN ROUTE! Teleporting in ${data.countdownSec}s...`;
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
      <div class="hub-mf-title">⚔️ ${isFr ? 'CONVOI EN ROUTE !' : 'CONVOY EN ROUTE!'}</div>
      <div class="hub-mf-desc">${isFr ? 'Téléportation vers la Citadelle dans' : 'Teleporting to Citadel in'} <strong>${data.countdownSec}s</strong></div>
      <div class="hub-mf-crypt">${isFr ? 'Crypte assignée : Angle #' : 'Assigned crypt: Corner #'}${data.spawnIndex + 1} (${data.totalPlayers} ${isFr ? 'aventurier(s)' : 'adventurer(s)'})</div>
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
      const localizedTitle = I18nService.t(`skin.${skin.id}.title`) || skin.title;
      const localizedName = I18nService.t(`skin.${skin.id}.name`) || skin.name;
      if (this.avatarTitle) this.avatarTitle.textContent = localizedTitle;
      if (this.skinName) this.skinName.textContent = localizedName;
    }

    if (!this.player) {
      return;
    }

    const isFr = I18nService.getCurrentLanguage() === 'fr';

    // 1. Mini aperçu des objets équipés sous forme d'icônes
    if (this.avatarGearPreview) {
      this.avatarGearPreview.innerHTML = '';
      const slots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];
      for (const slot of slots) {
        const item = this.player.inventory.getItem(slot);
        const slotEl = document.createElement('div');
        slotEl.className = `hub-gear-mini-slot ${item ? item.rarity : 'empty'}`;
        const slotLabel = I18nService.getSlotLabel(slot) || SLOT_LABELS[slot];
        const itemName = item ? I18nService.getItemTranslation(item).name : (isFr ? 'Vide' : 'Empty');
        slotEl.title = `${itemName} (${slotLabel})`;

        if (item) {
          const iconUrl = ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id);
          if (iconUrl) {
            slotEl.innerHTML = `<img src="${iconUrl}" alt="" class="hub-gear-mini-icon" />`;
          } else {
            slotEl.textContent = slotLabel[0];
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
          <span class="hub-stat-label">⭐ ${isFr ? 'PUISSANCE' : 'POWER'}</span>
          <span class="hub-stat-val font-yellow font-bold">${this.player.getGearScore()}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">❤️ ${isFr ? 'PV MAX' : 'MAX HP'}</span>
          <span class="hub-stat-val font-green">${this.player.maxHealth}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">🗡️ ${isFr ? 'DÉGÂTS' : 'DAMAGE'}</span>
          <span class="hub-stat-val font-red">${FIREBALL_CONFIG.DAMAGE + stats.damage + stats.magicPower}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">🛡️ ${isFr ? 'DÉFENSE' : 'DEFENSE'}</span>
          <span class="hub-stat-val font-blue">${stats.defense}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">💨 ${isFr ? 'VITESSE' : 'SPEED'}</span>
          <span class="hub-stat-val font-yellow">${speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`}</span>
        </div>
        <div class="hub-stat-row">
          <span class="hub-stat-label">⚡ ${isFr ? 'INCANTATION' : 'CAST SPEED'}</span>
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

    const isFr = I18nService.getCurrentLanguage() === 'fr';

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
      const slotLabel = I18nService.getSlotLabel(slot) || SLOT_LABELS[slot];
      const itemName = item ? I18nService.getItemTranslation(item).name : (isFr ? 'Emplacement libre' : 'Empty Slot');

      container.className = `hub-play-body-slot slot-${slot} ${rarityClass}`;
      container.title = '';
      container.innerHTML = `
        <div class="hub-body-slot-badge">${slotLabel}</div>
        <div class="hub-body-slot-icon-box">
          ${iconUrl ? `<img src="${iconUrl}" class="hub-body-slot-img" alt="" />` : `<span class="hub-body-slot-placeholder">${slotPlaceholders[slot]}</span>`}
        </div>
        <div class="hub-body-slot-info">
          <div class="hub-body-slot-name" style="color: ${item ? RARITY_COLORS[item.rarity] : '#64748b'}">
            ${itemName}
          </div>
          <div class="hub-body-slot-stats">
            ${item ? this.formatItemStats(item) : (isFr ? 'Aucun bonus direct' : 'No direct bonus')}
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
          label: isFr ? 'PUISSANCE TOTALE (GEAR SCORE)' : 'TOTAL POWER (GEAR SCORE)',
          desc: isFr ? 'Score global d\'équipement & niveau de la citadelle' : 'Overall equipment score & citadel tier',
          value: `${this.player.getGearScore()}`,
          colorClass: 'font-yellow font-bold',
        },
        {
          icon: '❤️',
          label: isFr ? 'POINTS DE VIE MAX' : 'MAX HEALTH POINTS',
          desc: isFr ? 'Endurance vitale face aux périls' : 'Vital endurance against dungeon hazards',
          value: `${this.player.maxHealth} ${isFr ? 'PV' : 'HP'}`,
          colorClass: 'font-green',
        },
        {
          icon: '🔮',
          label: isFr ? 'DÉGÂTS DES SORTS' : 'SPELL DAMAGE',
          desc: isFr ? 'Puissance offensive brute des arcanes' : 'Raw arcane offensive power',
          value: `${totalDamage}`,
          colorClass: 'font-red',
        },
        {
          icon: '🛡️',
          label: isFr ? 'DÉFENSE / ARMURE' : 'DEFENSE / ARMOR',
          desc: isFr ? 'Réduction directe des dégâts subis' : 'Direct damage reduction against all hits',
          value: `${stats.defense}`,
          colorClass: 'font-blue',
        },
        {
          icon: '💨',
          label: isFr ? 'VITESSE DE COURSE' : 'MOVEMENT SPEED',
          desc: isFr ? 'Agilité de déplacement et d\'esquive' : 'Walking agility and dodging pace',
          value: speedPct >= 0 ? `+${speedPct}%` : `${speedPct}%`,
          colorClass: 'font-yellow',
        },
        {
          icon: '⚡',
          label: isFr ? 'CADENCE D\'INCANTATION' : 'CASTING SPEED',
          desc: isFr ? 'Vitesse de récupération magique' : 'Cooldown recovery and casting swiftness',
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
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    // 1. Objets équipés (Paperdoll)
    if (this.equippedSlotsContainer) {
      this.equippedSlotsContainer.innerHTML = '';
      const slots: EquipmentSlot[] = ['hat', 'weapon', 'armor', 'boots', 'offhand'];

      for (const slot of slots) {
        const item = this.player.inventory.getItem(slot);
        const card = document.createElement('div');
        card.className = `hub-equip-slot-card ${item ? `rarity-${item.rarity}` : 'empty'}`;

        const iconUrl = item ? ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id) : null;
        const slotLabel = I18nService.getSlotLabel(slot) || SLOT_LABELS[slot];
        const itemName = item ? I18nService.getItemTranslation(item).name : (isFr ? 'Emplacement libre' : 'Empty Slot');

        card.innerHTML = `
          <div class="hub-slot-badge">${slotLabel}</div>
          <div class="hub-slot-icon-box">
            ${iconUrl ? `<img src="${iconUrl}" class="hub-slot-img" alt="" />` : `<span class="hub-empty-slot-text">${isFr ? 'VIDE' : 'EMPTY'}</span>`}
          </div>
          <div class="hub-slot-info">
            <div class="hub-slot-item-name" style="color: ${item ? RARITY_COLORS[item.rarity] : '#64748b'}">
              ${itemName}
            </div>
            ${item ? `<div class="hub-slot-stat-summary">${this.formatItemStats(item)}</div>` : ''}
          </div>
          ${item ? `<button class="hub-unequip-btn" type="button" title="${isFr ? 'Déséquiper vers la réserve' : 'Unequip to stash'}">${isFr ? 'RETIRER' : 'UNEQUIP'}</button>` : ''}
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
            <p>${isFr ? 'Votre réserve est vide.' : 'Your stash is empty.'}</p>
            <p class="hub-stash-empty-hint">${isFr ? 'Sécurisez des objets lors de vos expéditions ou visitez la Boutique pour en acheter !' : 'Secure items during your expeditions or visit the Shop to buy some!'}</p>
          </div>
        `;
      } else {
        for (const item of stash) {
          const itemCard = document.createElement('div');
          itemCard.className = `hub-stash-card rarity-${item.rarity}`;
          const iconUrl = ItemSpriteManager.getSpriteUrl(item.slot, item.rarity, item.id);
          const translatedItem = I18nService.getItemTranslation(item);
          const slotLabel = I18nService.getSlotLabel(item.slot) || SLOT_LABELS[item.slot];
          const rarityLabel = I18nService.getRarityLabel(item.rarity) || item.rarity;

          itemCard.innerHTML = `
            <div class="hub-stash-card-icon">
              ${iconUrl ? `<img src="${iconUrl}" class="hub-stash-img" alt="" />` : ''}
            </div>
            <div class="hub-stash-card-content">
              <div class="hub-stash-item-name" style="color: ${RARITY_COLORS[item.rarity]}">${translatedItem.name}</div>
              <div class="hub-stash-item-type">${slotLabel} • ${rarityLabel.toUpperCase()}</div>
              <div class="hub-stash-stats">${this.formatItemStats(item)}</div>
            </div>
            <button class="hub-equip-btn" type="button">${isFr ? 'ÉQUIPER' : 'EQUIP'}</button>
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
  }

  // =========================================================================
  // VUE 3 : BOUTIQUE (AMÉLIORATIONS ET ARSENAL)
  // =========================================================================
  private renderShopView(): void {
    const currentCoins = WalletManager.getCoins();
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    // 1. Améliorations permanentes
    if (this.upgradesListContainer) {
      this.upgradesListContainer.innerHTML = '';
      const upgradeIds: UpgradeId[] = ['vitality', 'power', 'defense', 'speed', 'casting'];

      for (const id of upgradeIds) {
        const def = UPGRADE_DEFINITIONS[id];
        const localized = UpgradeManager.getUpgradeLocalized(id);
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
              <span class="hub-upgrade-name">${localized.name}</span>
              <span class="hub-upgrade-level ${isMaxed ? 'font-yellow' : ''}">${stars} ${isFr ? 'Rang' : 'Rank'} ${level}/${def.maxLevel}</span>
            </div>
            <p class="hub-upgrade-desc">${localized.description}</p>
            <div class="hub-upgrade-effect font-green">✦ ${localized.statEffect}</div>
          </div>
          <div class="hub-upgrade-action">
            ${
              isMaxed
                ? `<span class="hub-badge-maxed">${isFr ? 'MAXIMISÉ' : 'MAXED'}</span>`
                : `<button class="hub-buy-btn ${canAfford ? '' : 'disabled'}" type="button">
                    ${isFr ? 'AMÉLIORER' : 'UPGRADE'}<br><span class="hub-cost-tag">${cost} 🪙</span>
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
        const translatedItem = I18nService.getItemTranslation(item);
        const slotLabel = I18nService.getSlotLabel(item.slot) || SLOT_LABELS[item.slot];
        const rarityLabel = I18nService.getRarityLabel(item.rarity) || item.rarity;

        const card = document.createElement('div');
        card.className = `hub-shop-item-card rarity-${item.rarity}`;

        card.innerHTML = `
          <div class="hub-shop-item-icon-box">
            ${iconUrl ? `<img src="${iconUrl}" class="hub-shop-item-img" alt="" />` : ''}
          </div>
          <div class="hub-shop-item-info">
            <div class="hub-shop-item-name" style="color: ${RARITY_COLORS[item.rarity]}">${translatedItem.name}</div>
            <div class="hub-shop-item-type">${slotLabel} • ${rarityLabel.toUpperCase()}</div>
            <div class="hub-shop-item-stats">${this.formatItemStats(item)}</div>
            ${translatedItem.effect ? `<div class="hub-shop-item-effect">« ${translatedItem.effect} »</div>` : ''}
          </div>
          <div class="hub-shop-item-action">
            <button class="hub-buy-item-btn ${canAfford ? '' : 'disabled'}" type="button">
              ${isFr ? 'ACHETER' : 'BUY'}<br><span class="hub-cost-tag">${price} 🪙</span>
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
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    for (const q of quests) {
      const card = document.createElement('div');
      card.className = `hub-quest-card ${q.completed ? 'completed' : ''} ${q.claimed ? 'claimed' : ''}`;
      const localized = QuestManager.getQuestLocalized(q);

      const progressPct = Math.min(100, Math.round((q.current / q.target) * 100));

      card.innerHTML = `
        <div class="hub-quest-icon">${q.icon}</div>
        <div class="hub-quest-details">
          <div class="hub-quest-title-row">
            <span class="hub-quest-title">${localized.title}</span>
            <span class="hub-quest-progress-text">${q.current} / ${q.target}</span>
          </div>
          <p class="hub-quest-desc">${localized.description}</p>
          <div class="hub-quest-bar-track">
            <div class="hub-quest-bar-fill" style="width: ${progressPct}%"></div>
          </div>
        </div>
        <div class="hub-quest-action">
          <div class="hub-quest-reward font-yellow">+${q.rewardCoins} 🪙</div>
          ${
            q.claimed
              ? `<span class="hub-quest-status claimed">${isFr ? 'ACCOMPLIE' : 'CLAIMED'}</span>`
              : q.completed
              ? `<button class="hub-claim-btn" type="button">${isFr ? 'RÉCLAMER !' : 'CLAIM!'}</button>`
              : `<span class="hub-quest-status pending">${isFr ? 'EN COURS' : 'IN PROGRESS'}</span>`
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

  private getGearScoreTier(gs: number): { label: string; color: string } {
    return GearScoreService.getGearScoreTier(gs);
  }

  // =========================================================================
  // VUE 5 : CLASSEMENT (LADDER)
  // =========================================================================
  private async renderLadderView(): Promise<void> {
    if (!this.ladderTbody) return;

    if (this.isLadderLoading) return;
    this.isLadderLoading = true;
    const isFr = I18nService.getCurrentLanguage() === 'fr';

    // Animation du bouton refresh si présent
    const refreshIcon = this.ladderRefreshBtn?.querySelector('.refresh-icon');
    refreshIcon?.classList.add('spinning');

    this.ladderTbody.innerHTML = `
      <tr class="ladder-loading-row">
        <td colspan="6">
          <div class="ladder-loading-box">
            <span class="ladder-loading-spinner">✦</span>
            <span>${isFr ? 'Consultation des archives du Panthéon de la Citadelle...' : 'Consulting Citadel Hall of Fame archives...'}</span>
          </div>
        </td>
      </tr>
    `;

    const currentUser = AuthManager.getUser();
    const currentGearScore = this.player ? GearScoreService.calculatePlayerGearScore(this.player) : 0;

    try {
      const { ladder, offline } = await AuthManager.fetchLadder(50);

      if (offline) {
        this.ladderTbody.innerHTML = `
          <tr class="ladder-empty-row">
            <td colspan="6">
              <div class="ladder-empty-box">
                <span class="ladder-empty-icon">📜</span>
                <span class="ladder-empty-title">${isFr ? 'Le Panthéon sommeille' : 'The Hall of Fame is sleeping'}</span>
                <span class="ladder-empty-desc">${isFr ? "La base de données PostgreSQL est actuellement hors-ligne. Démarrez le conteneur Docker ('docker compose up -d postgres') pour consulter le classement en direct." : "The PostgreSQL database is currently offline. Start the Docker container ('docker compose up -d postgres') to view live rankings."}</span>
              </div>
            </td>
          </tr>
        `;
      } else if (!ladder || ladder.length === 0) {
        this.ladderTbody.innerHTML = `
          <tr class="ladder-empty-row">
            <td colspan="6">
              <div class="ladder-empty-box">
                <span class="ladder-empty-icon">🛡️</span>
                <span class="ladder-empty-title">${isFr ? 'Aucun explorateur classé pour le moment' : 'No ranked explorers yet'}</span>
                <span class="ladder-empty-desc">${isFr ? 'Soyez le premier aventurier à équiper du butin et à inscrire votre légende !' : 'Be the first adventurer to equip loot and inscribe your legend!'}</span>
              </div>
            </td>
          </tr>
        `;
      } else {
        this.ladderTbody.innerHTML = '';

        ladder.forEach((entry) => {
          const isCurrentUser = currentUser && entry.username.toLowerCase() === currentUser.username.toLowerCase();
          const tier = this.getGearScoreTier(entry.maxGearScore);

          const row = document.createElement('tr');
          row.className = `ladder-row ${isCurrentUser ? 'is-current-user' : ''} ${entry.rank <= 3 ? `top-${entry.rank}` : ''}`;

          let rankBadge = `#${entry.rank}`;
          if (entry.rank === 1) rankBadge = '🥇 1';
          else if (entry.rank === 2) rankBadge = '🥈 2';
          else if (entry.rank === 3) rankBadge = '🥉 3';

          row.innerHTML = `
            <td class="td-rank">
              <span class="ladder-rank-badge rank-${entry.rank}">${rankBadge}</span>
            </td>
            <td class="td-adventurer">
              <div class="ladder-adventurer-cell">
                <span class="ladder-adventurer-name">${entry.username}</span>
                ${isCurrentUser ? `<span class="ladder-you-badge">${isFr ? 'VOUS' : 'YOU'}</span>` : ''}
              </div>
            </td>
            <td class="td-gearscore">
              <span class="ladder-gs-val" style="color: ${tier.color};">
                ⚔️ ${entry.maxGearScore}
              </span>
            </td>
            <td class="td-tier">
              <span class="ladder-tier-badge" style="border-color: ${tier.color}; color: ${tier.color};">
                ${tier.label}
              </span>
            </td>
            <td class="td-extractions">
              <span class="ladder-extractions-val">🏆 ${entry.raidsWon}</span>
            </td>
            <td class="td-slain">
              <span class="ladder-slain-val">💀 ${entry.monstersKilled}</span>
            </td>
          `;

          this.ladderTbody?.appendChild(row);
        });
      }

      // Carte utilisateur
      if (this.ladderCurrentUserCard) {
        if (currentUser) {
          const userEntry = ladder.find((e) => e.username.toLowerCase() === currentUser.username.toLowerCase());
          const maxGs = userEntry ? userEntry.maxGearScore : Math.max(0, currentGearScore);
          const tier = this.getGearScoreTier(maxGs);
          const rankText = userEntry ? `#${userEntry.rank}` : (isFr ? 'Non classé' : 'Unranked');

          this.ladderCurrentUserCard.innerHTML = `
            <div class="ladder-user-card-content">
              <div class="ladder-user-card-avatar">🛡️</div>
              <div class="ladder-user-card-meta">
                <span class="ladder-user-card-tag">${isFr ? 'VOTRE RECORD PERSONNEL' : 'YOUR PERSONAL RECORD'}</span>
                <span class="ladder-user-card-username">${currentUser.username}</span>
              </div>
              <div class="ladder-user-card-stats">
                <div class="ladder-user-stat-block">
                  <span class="stat-lbl">${isFr ? 'RANG :' : 'RANK:'}</span>
                  <span class="stat-val rank-val">${rankText}</span>
                </div>
                <div class="ladder-user-stat-block">
                  <span class="stat-lbl">${isFr ? 'GEAR SCORE MAX :' : 'MAX GEAR SCORE:'}</span>
                  <span class="stat-val gs-val" style="color: ${tier.color};">⚔️ ${maxGs}</span>
                </div>
                <div class="ladder-user-stat-block">
                  <span class="stat-lbl">${isFr ? 'TITRE :' : 'TITLE:'}</span>
                  <span class="stat-val tier-val" style="color: ${tier.color};">${tier.label}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          this.ladderCurrentUserCard.innerHTML = `
            <div class="ladder-user-card-guest">
              <span class="guest-warning-icon">⚠️</span>
              <div class="guest-warning-text">
                <strong>${isFr ? 'Mode Invité actif' : 'Guest Mode active'}</strong> : ${isFr ? 'Votre score actuel' : 'Your current score'} (${currentGearScore} GS) ${isFr ? "n'est pas sauvegardé sur la base de données." : "is not saved to the database."}
              </div>
              <button id="hub-ladder-login-btn" class="main-menu-btn main-menu-btn-primary ladder-login-btn" type="button">
                ${isFr ? 'SE CONNECTER' : 'LOG IN'}
              </button>
            </div>
          `;

          const loginBtn = document.getElementById('hub-ladder-login-btn');
          loginBtn?.addEventListener('click', () => {
            this.onReturnToMenuCallback?.();
            const mainAuthBtn = document.getElementById('main-auth-btn');
            mainAuthBtn?.click();
          });
        }
      }
    } catch (err: any) {
      if (this.ladderTbody) {
        this.ladderTbody.innerHTML = `
          <tr class="ladder-empty-row">
            <td colspan="6">
              <div class="ladder-empty-box">
                <span class="ladder-empty-icon">❌</span>
                <span class="ladder-empty-title">${isFr ? 'Erreur lors de la récupération' : 'Error retrieving rankings'}</span>
                <span class="ladder-empty-desc">${err.message}</span>
              </div>
            </td>
          </tr>
        `;
      }
    } finally {
      this.isLadderLoading = false;
      refreshIcon?.classList.remove('spinning');
    }
  }

  private formatItemStats(item: EquipmentItem): string {
    const parts: string[] = [];
    const gs = item.gearScore ?? GearScoreService.calculateItemGearScore(item);
    parts.push(`⭐ ${gs}`);
    const isFr = I18nService.getCurrentLanguage() === 'fr';
    if (item.stats.maxHealth) parts.push(`+${item.stats.maxHealth} ${isFr ? 'PV' : 'HP'}`);
    if (item.stats.damage) parts.push(`+${item.stats.damage} ${isFr ? 'Dégâts' : 'Dmg'}`);
    if (item.stats.defense) parts.push(`+${item.stats.defense} ${isFr ? 'Déf' : 'Def'}`);
    if (item.stats.magicPower) parts.push(`+${item.stats.magicPower} ${isFr ? 'Magie' : 'Magic'}`);
    if (item.stats.moveSpeed) parts.push(`+${Math.round(item.stats.moveSpeed * 100)}% ${isFr ? 'Vit' : 'Spd'}`);
    if (item.stats.castSpeed) parts.push(`+${Math.round(item.stats.castSpeed * 100)}% ${isFr ? 'Incant' : 'Cast'}`);
    return parts.length > 0 ? parts.join(' • ') : (isFr ? 'Aucun bonus direct' : 'No direct bonus');
  }
}
