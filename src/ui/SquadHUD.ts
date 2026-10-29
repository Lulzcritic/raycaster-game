import type { Player } from '../entities/Player';
import type { RemotePlayer } from '../entities/RemotePlayer';
import type { SquadSummaryPayload } from '../types/network';

/**
 * Cadre d'escouade retiré pour respecter les règles hardcore d'extraction PvPvE :
 * Dans un jeu d'extraction, aucun radar ni information de vie/position des autres joueurs
 * ne doit être affiché hors de leur présence physique directe dans le champ de vision du joueur.
 */
export class SquadHUD {
  constructor() {
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      const container = document.getElementById('squad-hud');
      if (container) {
        container.remove();
      }
    }
  }

  public update(
    _player: Player,
    _remotePlayers: readonly RemotePlayer[],
    _squadSummary?: SquadSummaryPayload | null
  ): void {
    // Désactivé en PvPvE
  }

  public show(): void {
    // Désactivé en PvPvE
  }

  public hide(): void {
    // Désactivé en PvPvE
  }
}
