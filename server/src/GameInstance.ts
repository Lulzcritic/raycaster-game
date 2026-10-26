import type { WebSocket } from 'ws';
import type {
  InstancePlayersPayload,
  MatchPlayerInfo,
  MatchStartPayload,
  PlayerShootPayload,
  PlayerUpdatePayload,
  RemotePlayerData,
  RemoteShootPayload,
} from '../../src/types/network';

export interface PlayerSession {
  ws: WebSocket;
  id: string;
  name: string;
  skinId: string;
  gearScore: number;
  spawnIndex: number;
  x: number;
  y: number;
  angle: number;
  isMoving: boolean;
  isAttacking: boolean;
  hp: number;
  maxHp: number;
  lastUpdate: number;
}

export class GameInstance {
  public readonly id: string;
  public readonly mapSeed: number;
  public readonly createdAt: number = Date.now();
  public readonly players: PlayerSession[] = [];
  public isActive = true;

  private tickInterval: NodeJS.Timeout | null = null;
  public onDestroyCallback?: (instanceId: string) => void;

  constructor(id: string, mapSeed: number, players: PlayerSession[]) {
    this.id = id;
    this.mapSeed = mapSeed;
    this.players = players;
  }

  public start(): void {
    const playerSummaries: MatchPlayerInfo[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      skinId: p.skinId,
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

    // Démarrage de la boucle de synchronisation temps réel (20 Hz / 50ms)
    this.tickInterval = setInterval(() => this.tick(), 50);
  }

  private tick(): void {
    if (!this.isActive || this.players.length === 0) return;

    const remotePlayers: RemotePlayerData[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      skinId: p.skinId,
      gearScore: p.gearScore,
      spawnIndex: p.spawnIndex,
      x: p.x,
      y: p.y,
      angle: p.angle,
      isMoving: p.isMoving,
      isAttacking: p.isAttacking,
      hp: p.hp,
      maxHp: p.maxHp,
    }));

    const payload: InstancePlayersPayload = { players: remotePlayers };
    const message = JSON.stringify({ type: 'INSTANCE_PLAYERS', payload });

    for (const p of this.players) {
      if (p.ws.readyState === p.ws.OPEN) {
        p.ws.send(message);
      }
    }
  }

  public handlePlayerUpdate(ws: WebSocket, payload: PlayerUpdatePayload): void {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    player.x = payload.x;
    player.y = payload.y;
    player.angle = payload.angle;
    player.isMoving = payload.isMoving;
    player.isAttacking = payload.isAttacking;
    player.hp = payload.hp;
    player.maxHp = payload.maxHp;
    player.lastUpdate = Date.now();
  }

  public handlePlayerShoot(ws: WebSocket, payload: PlayerShootPayload): void {
    const shooter = this.players.find((p) => p.ws === ws);
    if (!shooter) return;

    const remoteShootPayload: RemoteShootPayload = {
      shooterId: shooter.id,
      spellType: payload.spellType,
      originX: payload.originX,
      originY: payload.originY,
      angle: payload.angle,
      damage: payload.damage,
    };

    const message = JSON.stringify({ type: 'REMOTE_SHOOT', payload: remoteShootPayload });

    // Diffusion aux autres joueurs de l'instance
    for (const p of this.players) {
      if (p.ws !== ws && p.ws.readyState === p.ws.OPEN) {
        p.ws.send(message);
      }
    }
  }

  public removePlayer(playerId: string): void {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx !== -1) {
      this.players.splice(idx, 1);

      // Notification de départ aux joueurs restants
      const leftMsg = JSON.stringify({
        type: 'PLAYER_LEFT',
        payload: { playerId },
      });
      for (const p of this.players) {
        if (p.ws.readyState === p.ws.OPEN) {
          p.ws.send(leftMsg);
        }
      }
    }

    if (this.players.length === 0) {
      this.destroy();
    }
  }

  public destroy(): void {
    this.isActive = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.onDestroyCallback?.(this.id);
  }
}
