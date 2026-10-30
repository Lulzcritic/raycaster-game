import type { Player } from '../entities/Player';
import { RARITY_COLORS } from '../entities/ItemCardBillboard';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import { WalletManager } from '../core/WalletManager';
import { I18nService } from '../core/I18nService';
import type { SquadSummaryPayload } from '../types/network';

const SLOT_NAMES: Record<string, string> = {
  weapon: 'ARME',
  armor: 'ARMURE',
  hat: 'CHAPEAU',
  boots: 'BOTTES',
  key: 'CLE',
  offhand: 'MAIN GAUCHE',
};

export class HUDOverlay {
  private readonly playerHud: HTMLElement | null;
  private readonly healthFill: HTMLElement | null;
  private readonly healthText: HTMLElement | null;
  private readonly zonePanel: HTMLElement | null;
  private readonly zoneTitle: HTMLElement | null;
  private readonly raidTimer: HTMLElement | null;
  private readonly coinPanel: HTMLElement | null;
  private readonly coinText: HTMLElement | null;
  private readonly coinIcon: HTMLImageElement | null;
  private readonly spellPrimarySlot: HTMLElement | null;
  private readonly spellPrimaryOverlay: HTMLElement | null;
  private readonly spellSecondarySlot: HTMLElement | null;
  private readonly spellCooldownOverlay: HTMLElement | null;
  private readonly spellCooldownText: HTMLElement | null;
  private lastCoins = -1;

  private readonly extractionScreen: HTMLElement | null;
  private readonly extractionStats: HTMLElement | null;
  private readonly extractionLootList: HTMLElement | null;
  private readonly extractionRestartBtn: HTMLElement | null;
  private readonly extractionSquadSection: HTMLElement | null;

  private readonly deathScreen: HTMLElement | null;
  private readonly deathRespawnBtn: HTMLElement | null;
  private readonly deathSpectateBtn: HTMLElement | null;
  private readonly deathSquadSection: HTMLElement | null;

  private readonly spectatorBanner: HTMLElement | null;
  private readonly spectatorTargetName: HTMLElement | null;

  private isExtractedScreenShown = false;
  private isDeathScreenShown = false;
  private isPaused = false;

  constructor(onRestart: () => void, onSpectate?: () => void) {
    this.playerHud = document.getElementById('player-hud');
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthText = document.getElementById('hud-health-text');
    this.zonePanel = document.getElementById('hud-zone-panel');
    this.zoneTitle = document.getElementById('hud-zone-title');
    this.raidTimer = document.getElementById('hud-raid-timer');
    this.coinPanel = document.getElementById('hud-coin-panel');
    this.coinText = document.getElementById('hud-coin-text');
    this.coinIcon = document.getElementById('hud-coin-icon') as HTMLImageElement | null;
    this.spellPrimarySlot = document.getElementById('hud-spell-primary');
    this.spellPrimaryOverlay = document.getElementById('hud-spell-primary-overlay');
    this.spellSecondarySlot = document.getElementById('hud-spell-secondary');
    this.spellCooldownOverlay = document.getElementById('hud-spell-cooldown-overlay');
    this.spellCooldownText = document.getElementById('hud-spell-cooldown-text');

    if (this.coinIcon) {
      this.coinIcon.src = CoinSpriteManager.getCoinUrl();
    }

    this.extractionScreen = document.getElementById('extraction-screen');
    this.extractionStats = document.getElementById('extraction-stats');
    this.extractionLootList = document.getElementById('extraction-loot-list');
    this.extractionRestartBtn = document.getElementById('extraction-restart-btn');
    this.extractionSquadSection = document.getElementById('extraction-squad-section');

    this.deathScreen = document.getElementById('death-screen');
    this.deathRespawnBtn = document.getElementById('death-respawn-btn');
    this.deathSpectateBtn = document.getElementById('death-spectate-btn');
    this.deathSquadSection = document.getElementById('death-squad-section');

    this.spectatorBanner = document.getElementById('spectator-banner');
    this.spectatorTargetName = document.getElementById('spectator-target-name');

    if (this.deathSpectateBtn && onSpectate) {
      this.deathSpectateBtn.addEventListener('click', () => {
        onSpectate();
      });
    }

    if (this.extractionRestartBtn) {
      this.extractionRestartBtn.addEventListener('click', () => {
        this.reset();
        onRestart();
      });
    }

    if (this.deathRespawnBtn) {
      this.deathRespawnBtn.addEventListener('click', () => {
        this.reset();
        onRestart();
      });
    }
  }

  public reset(): void {
    this.isExtractedScreenShown = false;
    this.isDeathScreenShown = false;
    this.lastCoins = -1;
    this.extractionScreen?.classList.add('hidden');
    this.deathScreen?.classList.add('hidden');
    this.deathSpectateBtn?.classList.add('hidden');
    this.hideSpectatorBanner();
    this.spellPrimaryOverlay?.classList.add('hidden');
    this.spellPrimarySlot?.classList.remove('on-cooldown');
    this.spellCooldownOverlay?.classList.add('hidden');
    if (this.spellCooldownText) {
      this.spellCooldownText.textContent = '';
    }
    this.spellSecondarySlot?.classList.remove('on-cooldown');
  }

  public update(
    player: Player,
    raidTimerSec: number,
    isExtracted: boolean,
    lostHomonculusOnExtract = false,
    squadSummary?: SquadSummaryPayload | null,
    canSpectate = false,
    isSpectating = false
  ): void {
    const isAlive = player.isAlive();

    // Mode spectateur actif (Phase 4)
    if (isSpectating) {
      this.deathScreen?.classList.add('hidden');
      this.extractionScreen?.classList.add('hidden');
      if (this.playerHud) this.playerHud.style.display = 'none';
      return;
    }

    this.hideSpectatorBanner();

    // 1. Écran de Mort
    if (!isAlive && !isExtracted) {
      if (!this.isDeathScreenShown) {
        this.isDeathScreenShown = true;
        this.deathScreen?.classList.remove('hidden');
        if (this.playerHud) this.playerHud.style.display = 'none';
        if (typeof document !== 'undefined' && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      this.renderSquadSection(this.deathSquadSection, squadSummary);
      if (canSpectate) {
        this.deathSpectateBtn?.classList.remove('hidden');
      } else {
        this.deathSpectateBtn?.classList.add('hidden');
      }
      return;
    }

    if (this.isDeathScreenShown && isAlive) {
      this.isDeathScreenShown = false;
      this.deathScreen?.classList.add('hidden');
    }

    // 2. Écran d'Extraction réussie
    if (isExtracted) {
      if (!this.isExtractedScreenShown) {
        this.isExtractedScreenShown = true;
        this.renderExtractionScreen(player, raidTimerSec, lostHomonculusOnExtract);
        this.extractionScreen?.classList.remove('hidden');
        if (this.playerHud) this.playerHud.style.display = 'none';
      }
      this.renderSquadSection(this.extractionSquadSection, squadSummary);
      return;
    }

    if (this.isExtractedScreenShown && !isExtracted) {
      this.isExtractedScreenShown = false;
      this.extractionScreen?.classList.add('hidden');
    }

    // 3. HUD Joueur actif pendant le jeu
    if (this.playerHud) {
      this.playerHud.style.display = !this.isPaused ? 'flex' : 'none';
    }

    // Santé
    const hp = Math.max(0, player.health);
    const maxHp = player.maxHealth;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const percent = Math.round(ratio * 100);

    if (this.healthFill) {
      this.healthFill.style.width = `${percent}%`;
      if (ratio <= 0.25) {
        this.healthFill.className = 'hud-health-fill critical';
      } else if (ratio <= 0.5) {
        this.healthFill.className = 'hud-health-fill caution';
      } else {
        this.healthFill.className = 'hud-health-fill';
      }
    }

    const isFr = I18nService.getCurrentLanguage() === 'fr';

    if (this.healthText) {
      const slowSuffix = player.isSlowed()
        ? (isFr ? ' [GLAÇAGE : -55% VIT]' : ' [CHILLED: -55% SPD]')
        : '';
      this.healthText.textContent = `${isFr ? 'PV' : 'HP'} ${Math.ceil(hp)} / ${maxHp}${slowSuffix}`;
      this.healthText.style.color = player.isSlowed() ? '#fdba74' : '#ffffff';
    }

    // Zone & Chronomètre
    const distFromCenter = Math.hypot(player.x - 32, player.y - 32);
    let zoneName = isFr ? 'ZONE 1 - QUARTIER DE DÉPART' : 'ZONE 1 - STARTING DISTRICT';
    let zoneColor = '#38bdf8';

    if (distFromCenter <= 7) {
      zoneName = isFr ? 'ZONE 3 - SANCTUAIRE DU BOSS' : 'ZONE 3 - BOSS SANCTUARY';
      zoneColor = '#ef4444';
    } else if (distFromCenter <= 19) {
      zoneName = isFr ? 'ZONE 2 - ANNEAU CENTRAL (PARTAGÉE)' : 'ZONE 2 - CENTRAL RING (SHARED)';
      zoneColor = '#f59e0b';
    }

    if (this.zoneTitle) {
      this.zoneTitle.textContent = zoneName;
      this.zoneTitle.style.color = zoneColor;
    }

    if (this.zonePanel) {
      this.zonePanel.style.borderColor = zoneColor;
    }

    const timerMin = Math.floor(raidTimerSec / 60);
    const timerSec = Math.floor(raidTimerSec % 60);
    const formattedTimer = `${timerMin.toString().padStart(2, '0')}:${timerSec.toString().padStart(2, '0')}`;

    if (this.raidTimer) {
      this.raidTimer.textContent = `⏱️ RAID ${formattedTimer}`;
    }

    // 3. Compteur de pièces d'or
    const currentCoins = WalletManager.getCoins();
    if (this.coinText && currentCoins !== this.lastCoins) {
      this.coinText.textContent = String(currentCoins);
      if (this.lastCoins >= 0 && currentCoins > this.lastCoins && this.coinPanel) {
        this.coinPanel.classList.remove('hud-coin-bump');
        void this.coinPanel.offsetWidth;
        this.coinPanel.classList.add('hud-coin-bump');
      }
      this.lastCoins = currentCoins;
    }

    // 4. Sorts & Cooldowns
    const primaryCd = player.getPrimaryCooldown();
    if (primaryCd > 0) {
      if (this.spellPrimaryOverlay) {
        this.spellPrimaryOverlay.classList.remove('hidden');
        const ratio = Math.max(0, Math.min(1, primaryCd / 0.45));
        this.spellPrimaryOverlay.style.height = `${Math.round(ratio * 100)}%`;
      }
      this.spellPrimarySlot?.classList.add('on-cooldown');
    } else {
      this.spellPrimaryOverlay?.classList.add('hidden');
      this.spellPrimarySlot?.classList.remove('on-cooldown');
    }

    // Sort secondaire (Orbe violette rebondissante)
    const secondaryCd = player.getSecondaryCooldown();
    const maxCd = player.getMaxSecondaryCooldown();
    if (secondaryCd > 0) {
      if (this.spellCooldownOverlay) {
        this.spellCooldownOverlay.classList.remove('hidden');
        const ratio = Math.max(0, Math.min(1, secondaryCd / maxCd));
        this.spellCooldownOverlay.style.height = `${Math.round(ratio * 100)}%`;
      }
      if (this.spellCooldownText) {
        this.spellCooldownText.textContent = `${secondaryCd.toFixed(1)}s`;
      }
      this.spellSecondarySlot?.classList.add('on-cooldown');
    } else {
      this.spellCooldownOverlay?.classList.add('hidden');
      if (this.spellCooldownText) {
        this.spellCooldownText.textContent = '';
      }
      this.spellSecondarySlot?.classList.remove('on-cooldown');
    }
  }

  public setVisible(visible: boolean): void {
    this.isPaused = !visible;
    if (this.playerHud) {
      this.playerHud.style.display =
        visible && !this.isExtractedScreenShown && !this.isDeathScreenShown
          ? 'flex'
          : 'none';
    }
  }

  private renderExtractionScreen(
    player: Player,
    raidTimerSec: number,
    lostHomonculusOnExtract = false
  ): void {
    const isFr = I18nService.getCurrentLanguage() === 'fr';
    const timerMin = Math.floor(raidTimerSec / 60);
    const timerSec = Math.floor(raidTimerSec % 60);
    const formattedTimer = `${timerMin.toString().padStart(2, '0')}:${timerSec.toString().padStart(2, '0')}`;

    if (this.extractionStats) {
      this.extractionStats.innerHTML = `
        <span>⏱️ ${isFr ? 'TEMPS DE RAID' : 'RAID TIME'} : <strong style="color: #f59e0b;">${formattedTimer}</strong></span>
        <span>❤️ ${isFr ? 'PV RESTANTS' : 'REMAINING HP'} : <strong style="color: #ef4444;">${Math.ceil(player.health)}/${player.maxHealth}</strong></span>
        <span>💰 ${isFr ? "BUTIN D'OR" : 'GOLD LOOT'} : <strong style="color: #fbbf24;">+${WalletManager.getSessionCoins()} (TOTAL : ${WalletManager.getCoins()})</strong></span>
      `;
    }

    if (this.extractionLootList) {
      this.extractionLootList.innerHTML = '';
      const slots: Array<'weapon' | 'armor' | 'hat' | 'boots' | 'key'> = [
        'weapon',
        'armor',
        'hat',
        'boots',
        'key',
      ];

      let hasItems = false;
      for (const slot of slots) {
        const item = player.inventory.getItem(slot);
        if (item) {
          hasItems = true;
          const row = document.createElement('div');
          row.className = 'extraction-loot-row';

          const rarityColor = RARITY_COLORS[item.rarity] ?? '#ffffff';
          const slotLabel = I18nService.getSlotLabel(item.slot) || SLOT_NAMES[item.slot] || item.slot.toUpperCase();
          const translatedItem = I18nService.getItemTranslation(item);
          const spriteUrl = ItemSpriteManager.getItemSpriteUrl(item);
          const iconHtml = spriteUrl
            ? `<img src="${spriteUrl}" alt="" style="width: 20px; height: 20px; object-fit: contain; image-rendering: pixelated; margin-right: 6px; vertical-align: middle;">`
            : '';

          row.innerHTML = `
            <span class="extraction-loot-slot" style="display: flex; align-items: center;">${iconHtml}[${slotLabel}]</span>
            <span class="extraction-loot-name" style="color: ${rarityColor};">${translatedItem.name}</span>
          `;
          this.extractionLootList.appendChild(row);
        }
      }

      if (lostHomonculusOnExtract) {
        const unextractableRow = document.createElement('div');
        unextractableRow.className = 'extraction-loot-row';
        unextractableRow.style.opacity = '0.85';
        unextractableRow.style.borderLeft = '3px solid #b048f8';
        unextractableRow.style.paddingLeft = '8px';
        unextractableRow.style.marginTop = '6px';
        unextractableRow.innerHTML = `
          <span class="extraction-loot-slot" style="color: #c084fc;">[${isFr ? 'NON EXTRACTIBLE' : 'NON-EXTRACTABLE'}]</span>
          <span class="extraction-loot-name" style="color: #e879f9; text-decoration: line-through;">Homonculus</span>
          <span style="font-size: 11px; color: #a855f7; margin-left: 6px;">(${isFr ? 'dissous dans le portail' : 'dissolved in portal'})</span>
        `;
        this.extractionLootList.appendChild(unextractableRow);
      }

      if (!hasItems && !lostHomonculusOnExtract) {
        const emptyNotice = document.createElement('div');
        emptyNotice.className = 'extraction-loot-empty';
        emptyNotice.textContent = isFr ? '(Aucun équipement emporté)' : '(No equipment carried)';
        this.extractionLootList.appendChild(emptyNotice);
      }
    }
  }

  public renderSquadSection(
    container: HTMLElement | null,
    squadSummary?: SquadSummaryPayload | null
  ): void {
    if (!container || !squadSummary || squadSummary.players.length === 0) {
      if (container) container.classList.add('hidden');
      return;
    }

    const isFr = I18nService.getCurrentLanguage() === 'fr';

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="extraction-loot-title" style="margin-top: 12px; margin-bottom: 8px;">--- ${isFr ? "RAPPORT DE L'EXPÉDITION (JOUEURS)" : 'EXPEDITION REPORT (PLAYERS)'} ---</div>
      <div class="extraction-squad-grid" style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
        ${squadSummary.players
          .map((p) => {
            const isExt = p.status === 'extracted';
            const isDead = p.status === 'dead';
            const statusHtml = isExt
              ? `<span style="color: #34d399; font-weight: bold;">🏆 ${isFr ? 'EXTRAIT' : 'EXTRACTED'} (${p.portalName ?? (isFr ? 'Portail' : 'Portal')})</span>`
              : isDead
              ? `<span style="color: #f87171; font-weight: bold;">💀 ${isFr ? 'MORT' : 'DEAD'}</span>`
              : `<span style="color: #60a5fa; font-weight: bold;">⚔️ ${isFr ? 'EN DONJON' : 'IN DUNGEON'}</span>`;

            return `
              <div class="extraction-squad-card ${p.status}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 12, 28, 0.7); border: 1px solid rgba(255, 255, 255, 0.15); padding: 6px 12px;">
                <div class="squad-card-name" style="font-weight: bold; color: #e0e7ff;">
                  🧙 ${p.name} <span style="color: #facc15; font-size: 11px; margin-left: 6px;">⭐ ${p.gearScore}</span>
                </div>
                <div class="squad-card-status" style="font-size: 12px;">${statusHtml}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  public showSpectatorBanner(targetName: string): void {
    if (this.spectatorBanner) {
      this.spectatorBanner.classList.remove('hidden');
    }
    if (this.spectatorTargetName) {
      this.spectatorTargetName.textContent = targetName;
    }
    this.deathScreen?.classList.add('hidden');
    this.extractionScreen?.classList.add('hidden');
  }

  public hideSpectatorBanner(): void {
    this.spectatorBanner?.classList.add('hidden');
  }
}
