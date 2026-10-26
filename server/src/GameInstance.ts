import type { WebSocket } from 'ws';
import type { MatchPlayerInfo, MatchStartPayload } from '../../src/types/network';

export interface PlayerSession {
  ws: WebSocket;
  id: string;
  name: string;
  gearScore: number;
  spawnIndex: number;
}

export class GameInstance {
  public readonly id: string;
  public readonly mapSeed: number;
  public readonly createdAt: number = Date.now();
  public readonly players: PlayerSession[] = [];
  public isActive = true;

  constructor(id: string, mapSeed: number, players: PlayerSession[]) {
    this.id = id;
    this.mapSeed = mapSeed;
    this.players = players;
  }

  public start(): void {
    const playerSummaries: MatchPlayerInfo[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      gearScore: p.gearScore,
      spawnIndex: p.spawnIndex,
    }));

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.ws.readyState === p.ws.OPEN) {
        const payload: MatchStartPayload = {
          instanceId: this.id,
          mapSeed: this.mapSeed,
          playerIndex: i,
          spawnIndex: p.spawnIndex,
          players: playerSummaries,
        };

        p.ws.send(JSON.stringify({ type: 'MATCH_START', payload }));
      }
    }
  }

  public removePlayer(playerId: string): void {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx !== -1) {
      this.players.splice(idx, 1);
    }
    if (this.players.length === 0) {
      this.destroy();
    }
  }

  public destroy(): void {
    this.isActive = false;
  }
}
