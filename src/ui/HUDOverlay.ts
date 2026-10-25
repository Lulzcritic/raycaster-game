import type { Player } from '../entities/Player';
import { RARITY_COLORS } from '../entities/ItemCardBillboard';
import { ItemSpriteManager } from '../graphics/ItemSpriteManager';
import { CoinSpriteManager } from '../graphics/CoinSpriteManager';
import { WalletManager } from '../core/WalletManager';

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
  private readonly spellSecondarySlot: HTMLElement | null;
  private readonly spellCooldownOverlay: HTMLElement | null;
  private readonly spellCooldownText: HTMLElement | null;
  private lastCoins = -1;

  private readonly extractionScreen: HTMLElement | null;
  private readonly extractionStats: HTMLElement | null;
  private readonly extractionLootList: HTMLElement | null;
  private readonly extractionRestartBtn: HTMLElement | null;

  private readonly deathScreen: HTMLElement | null;
  private readonly deathRespawnBtn: HTMLElement | null;

  private isExtractedScreenShown = false;
  private isDeathScreenShown = false;
  private isPaused = false;

  constructor(onRestart: () => void) {
    this.playerHud = document.getElementById('player-hud');
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthText = document.getElementById('hud-health-text');
    this.zonePanel = document.getElementById('hud-zone-panel');
    this.zoneTitle = document.getElementById('hud-zone-title');
    this.raidTimer = document.getElementById('hud-raid-timer');
    this.coinPanel = document.getElementById('hud-coin-panel');
    this.coinText = document.getElementById('hud-coin-text');
    this.coinIcon = document.getElementById('hud-coin-icon') as HTMLImageElement | null;
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

    this.deathScreen = document.getElementById('death-screen');
    this.deathRespawnBtn = document.getElementById('death-respawn-btn');

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
    lostHomonculusOnExtract = false
  ): void {
    const isAlive = player.isAlive();

    // 1. Écran de Mort
    if (!isAlive && !isExtracted) {
      if (!this.isDeathScreenShown) {
        this.isDeathScreenShown = true;
        this.deathScreen?.classList.remove('hidden');
        if (this.playerHud) this.playerHud.style.display = 'none';
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

    if (this.healthText) {
      const slowSuffix = player.isSlowed() ? ' [GLAÇAGE : -55% VIT]' : '';
      this.healthText.textContent = `PV ${Math.ceil(hp)} / ${maxHp}${slowSuffix}`;
      this.healthText.style.color = player.isSlowed() ? '#fdba74' : '#ffffff';
    }

    // Zone & Chronomètre
    const distFromCenter = Math.hypot(player.x - 32, player.y - 32);
    let zoneName = 'ZONE 1 - QUARTIER DE DEPART';
    let zoneColor = '#38bdf8';

    if (distFromCenter <= 7) {
      zoneName = 'ZONE 3 - SANCTUAIRE DU BOSS';
      zoneColor = '#ef4444';
    } else if (distFromCenter <= 19) {
      zoneName = 'ZONE 2 - ANNEAU CENTRAL (PARTAGEE)';
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

    // 4. Sort secondaire (Orbe violette rebondissante)
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
    const timerMin = Math.floor(raidTimerSec / 60);
    const timerSec = Math.floor(raidTimerSec % 60);
    const formattedTimer = `${timerMin.toString().padStart(2, '0')}:${timerSec.toString().padStart(2, '0')}`;

    if (this.extractionStats) {
      this.extractionStats.innerHTML = `
        <span>⏱️ TEMPS DE RAID : <strong style="color: #f59e0b;">${formattedTimer}</strong></span>
        <span>❤️ PV RESTANTS : <strong style="color: #ef4444;">${Math.ceil(player.health)}/${player.maxHealth}</strong></span>
        <span>💰 BUTIN D'OR : <strong style="color: #fbbf24;">+${WalletManager.getSessionCoins()} (TOTAL : ${WalletManager.getCoins()})</strong></span>
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
          const slotLabel = SLOT_NAMES[item.slot] ?? item.slot.toUpperCase();
          const spriteUrl = ItemSpriteManager.getItemSpriteUrl(item);
          const iconHtml = spriteUrl
            ? `<img src="${spriteUrl}" alt="" style="width: 20px; height: 20px; object-fit: contain; image-rendering: pixelated; margin-right: 6px; vertical-align: middle;">`
            : '';

          row.innerHTML = `
            <span class="extraction-loot-slot" style="display: flex; align-items: center;">${iconHtml}[${slotLabel}]</span>
            <span class="extraction-loot-name" style="color: ${rarityColor};">${item.name}</span>
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
          <span class="extraction-loot-slot" style="color: #c084fc;">[NON EXTRACTIBLE]</span>
          <span class="extraction-loot-name" style="color: #e879f9; text-decoration: line-through;">Homonculus</span>
          <span style="font-size: 11px; color: #a855f7; margin-left: 6px;">(dissous dans le portail)</span>
        `;
        this.extractionLootList.appendChild(unextractableRow);
      }

      if (!hasItems && !lostHomonculusOnExtract) {
        const emptyNotice = document.createElement('div');
        emptyNotice.className = 'extraction-loot-empty';
        emptyNotice.textContent = '(Aucun équipement emporté)';
        this.extractionLootList.appendChild(emptyNotice);
      }
    }
  }
}
