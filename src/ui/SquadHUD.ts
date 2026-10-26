import type { Player } from '../entities/Player';
import type { RemotePlayer } from '../entities/RemotePlayer';
import type { SquadSummaryPayload } from '../types/network';

/**
 * Cadre d'escouade en direct en haut à gauche (Phase 4).
 * Affiche l'état des équipiers (PV en direct, jauge, boussole relative et distance).
 */
export class SquadHUD {
  private container: HTMLElement | null = null;
  private membersContainer: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;

  constructor() {
    this.buildDOM();
  }

  private buildDOM(): void {
    let container = document.getElementById('squad-hud');
    if (!container) {
      container = document.createElement('div');
      container.id = 'squad-hud';
      container.className = 'squad-hud hidden';

      const title = document.createElement('div');
      title.className = 'squad-hud-header';
      title.innerHTML = '🛡️ ESCOUADE DE CONVOI';
      container.appendChild(title);

      const list = document.createElement('div');
      list.id = 'squad-hud-members';
      list.className = 'squad-hud-members';
      container.appendChild(list);

      document.body.appendChild(container);
    }

    this.container = container;
    this.membersContainer = document.getElementById('squad-hud-members');
    this.titleEl = container.querySelector('.squad-hud-header');
  }

  public update(
    player: Player,
    remotePlayers: readonly RemotePlayer[],
    squadSummary?: SquadSummaryPayload | null
  ): void {
    if (!this.container || !this.membersContainer) return;

    if (remotePlayers.length === 0 && (!squadSummary || squadSummary.players.length <= 1)) {
      this.container.classList.add('hidden');
      return;
    }

    this.container.classList.remove('hidden');

    const totalCount = remotePlayers.length + 1;
    if (this.titleEl) {
      this.titleEl.textContent = `🛡️ ESCOUADE (${totalCount}/4)`;
    }

    this.membersContainer.innerHTML = '';

    // Affichage de chaque équipier
    for (const remote of remotePlayers) {
      const summary = squadSummary?.players.find((p) => p.id === remote.id);
      const isDead = remote.hp <= 0 || summary?.status === 'dead';
      const isExtracted = summary?.status === 'extracted';

      const card = document.createElement('div');
      card.className = `squad-member-card${isDead ? ' is-dead' : ''}${isExtracted ? ' is-extracted' : ''}`;

      // Calcul de la distance et de la direction boussole
      const dx = remote.x - player.x;
      const dy = remote.y - player.y;
      const distance = Math.round(Math.hypot(dx, dy));

      let angleDiff = Math.atan2(dy, dx) - player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      const compassArrow = this.getCompassArrow(angleDiff);

      let statusBadge = `<span class="squad-member-dir">${compassArrow} ${distance}m</span>`;
      if (isExtracted) {
        statusBadge = `<span class="squad-member-badge extracted">🏆 EXTRAIT</span>`;
      } else if (isDead) {
        statusBadge = `<span class="squad-member-badge dead">💀 MORT</span>`;
      }

      const hpPct = Math.max(0, Math.min(100, Math.round((remote.hp / remote.maxHp) * 100)));

      card.innerHTML = `
        <div class="squad-member-top">
          <span class="squad-member-name">🧙 ${remote.name}</span>
          <span class="squad-member-gs">⭐ ${remote.gearScore}</span>
          ${statusBadge}
        </div>
        <div class="squad-member-hp-track">
          <div class="squad-member-hp-fill" style="width: ${hpPct}%"></div>
          <span class="squad-member-hp-text">${remote.hp} / ${remote.maxHp}</span>
        </div>
      `;

      this.membersContainer.appendChild(card);
    }
  }

  private getCompassArrow(angleDiff: number): string {
    // 8 quadrants cardinaux / intercardinaux
    const octant = Math.round((angleDiff / (Math.PI / 4)) + 8) % 8;
    switch (octant) {
      case 0: return '↑';  // Devant
      case 1: return '↗';  // Devant-droite
      case 2: return '→';  // Droite
      case 3: return '↘';  // Arrière-droite
      case 4: return '↓';  // Arrière
      case 5: return '↙';  // Arrière-gauche
      case 6: return '←';  // Gauche
      case 7: return '↖';  // Devant-gauche
      default: return '↑';
    }
  }

  public show(): void {
    this.container?.classList.remove('hidden');
  }

  public hide(): void {
    this.container?.classList.add('hidden');
    if (this.membersContainer) {
      this.membersContainer.innerHTML = '';
    }
  }
}
