import type { WebSocket } from 'ws';
import type {
  ClientMessage,
  JoinQueuePayload,
  MatchFoundPayload,
  QueueStatusPayload,
  ServerMessage,
} from '../../src/types/network';
import { GameInstance, type PlayerSession } from './GameInstance';

export interface QueuedPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  skinId: string;
  gearScore: number;
  joinedAt: number;
}

export class Matchmaker {
  public static readonly CYCLE_DURATION_SEC = 60;
  public static readonly MAX_PLAYERS_PER_INSTANCE = 4;
  public static readonly COUNTDOWN_TRANSITION_SEC = 3;

  private cycleCountdownSec = Matchmaker.CYCLE_DURATION_SEC;
  private readonly queue: QueuedPlayer[] = [];
  private readonly connectedClients = new Set<WebSocket>();
  private readonly activeInstances = new Map<string, GameInstance>();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCycleTimer();
  }

  public registerClient(ws: WebSocket): void {
    this.connectedClients.add(ws);
    // Envoi immédiat du statut du convoi au nouvel arrivant
    this.sendQueueStatusTo(ws);
  }

  public unregisterClient(ws: WebSocket): void {
    this.connectedClients.delete(ws);
    this.leaveQueue(ws);

    // Déconnexion d'une instance en cours si applicable
    for (const instance of this.activeInstances.values()) {
      const playerInInstance = instance.players.find((p) => p.ws === ws);
      if (playerInInstance) {
        instance.removePlayer(playerInInstance.id);
      }
    }
  }

  public handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'JOIN_QUEUE':
        this.joinQueue(ws, message.payload);
        break;
      case 'LEAVE_QUEUE':
        this.leaveQueue(ws);
        break;
      case 'PING':
        this.sendMessage(ws, {
          type: 'PONG',
          payload: { timestamp: message.payload.timestamp },
        });
        break;
      case 'PLAYER_UPDATE': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handlePlayerUpdate(ws, message.payload);
        }
        break;
      }
      case 'PLAYER_SHOOT': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handlePlayerShoot(ws, message.payload);
        }
        break;
      }
      case 'LEAVE_MATCH': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          const player = instance.players.find((p) => p.ws === ws);
          if (player) {
            instance.removePlayer(player.id);
          }
        }
        break;
      }
      case 'CHEST_OPENED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handleChestOpened(ws, message.payload);
        }
        break;
      }
      case 'ITEM_PICKED_UP': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handleItemPickedUp(ws, message.payload);
        }
        break;
      }
      case 'ITEM_DROPPED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handleItemDropped(ws, message.payload);
        }
        break;
      }
      case 'DOOR_OPENED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handleDoorOpened(ws, message.payload);
        }
        break;
      }
      case 'PLAYER_EXTRACTED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handlePlayerExtracted(ws, message.payload);
        }
        break;
      }
      case 'PLAYER_DIED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handlePlayerDied(ws, message.payload);
        }
        break;
      }
      case 'BOSS_DEFEATED': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handleBossDefeated(ws, message.payload);
        }
        break;
      }
      case 'PLAYER_PING': {
        const instance = this.activeInstances.get(message.payload.instanceId);
        if (instance) {
          instance.handlePlayerPing(ws, message.payload);
        }
        break;
      }
    }
  }

  public joinQueue(ws: WebSocket, payload: JoinQueuePayload): void {
    const existingIndex = this.queue.findIndex((p) => p.ws === ws);
    const id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const skinId = payload.skinId || 'puzzle_lord';

    if (existingIndex !== -1) {
      this.queue[existingIndex].name = payload.playerName || 'Aventurier';
      this.queue[existingIndex].skinId = skinId;
      this.queue[existingIndex].gearScore = payload.gearScore || 30;
    } else {
      this.queue.push({
        ws,
        id,
        name: payload.playerName || 'Aventurier',
        skinId,
        gearScore: payload.gearScore || 30,
        joinedAt: Date.now(),
      });
      console.log(
        `[Matchmaker] Joueur inscrit: ${payload.playerName} (GS: ${payload.gearScore}, Skin: ${skinId}) | File: ${this.queue.length}`
      );
    }

    this.broadcastQueueStatus();
  }

  public leaveQueue(ws: WebSocket): void {
    const idx = this.queue.findIndex((p) => p.ws === ws);
    if (idx !== -1) {
      const removed = this.queue.splice(idx, 1)[0];
      console.log(`[Matchmaker] Joueur a quitté la file: ${removed.name}`);
      this.broadcastQueueStatus();
    }
  }

  private startCycleTimer(): void {
    this.timer = setInterval(() => {
      this.cycleCountdownSec--;

      if (this.cycleCountdownSec <= 0) {
        this.dispatchMatches();
        this.cycleCountdownSec = Matchmaker.CYCLE_DURATION_SEC;
      }

      this.broadcastQueueStatus();
    }, 1000);
  }

  /**
   * Création des instances à l'échéance de la minute pour tous les joueurs en attente
   */
  private dispatchMatches(): void {
    if (this.queue.length === 0) {
      console.log(`[Matchmaker] Fin de cycle 60s : aucun joueur en file.`);
      return;
    }

    console.log(
      `[Matchmaker] ⏱️ LANCEMENT DU CONVOI : ${this.queue.length} joueur(s) prêts !`
    );

    // Découpage en groupes de maximum 4 joueurs
    while (this.queue.length > 0) {
      const group = this.queue.splice(0, Matchmaker.MAX_PLAYERS_PER_INSTANCE);
      this.createAndLaunchInstance(group);
    }
  }

  private createAndLaunchInstance(group: QueuedPlayer[]): void {
    const instanceId = `citadel_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const mapSeed = Math.floor(Math.random() * 1000000);

    const playerSessions: PlayerSession[] = group.map((p, index) => ({
      ws: p.ws,
      id: p.id,
      name: p.name,
      skinId: p.skinId,
      gearScore: p.gearScore,
      spawnIndex: index % 4, // Attribue une crypte de coin différente (0, 1, 2 ou 3)
      x: 0,
      y: 0,
      angle: 0,
      isMoving: false,
      isAttacking: false,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
    }));

    const instance = new GameInstance(instanceId, mapSeed, playerSessions);
    instance.onDestroyCallback = (id) => {
      this.activeInstances.delete(id);
    };
    this.activeInstances.set(instanceId, instance);

    console.log(
      `[Matchmaker] Instance créée: ${instanceId} (Seed: ${mapSeed}) avec ${group.length} joueur(s).`
    );

    // 1. Envoi du signal MATCH_FOUND avec compte à rebours de 3s
    for (let i = 0; i < playerSessions.length; i++) {
      const p = playerSessions[i];
      if (p.ws.readyState === p.ws.OPEN) {
        const foundPayload: MatchFoundPayload = {
          instanceId,
          mapSeed,
          playerIndex: i,
          totalPlayers: playerSessions.length,
          spawnIndex: p.spawnIndex,
          countdownSec: Matchmaker.COUNTDOWN_TRANSITION_SEC,
        };
        this.sendMessage(p.ws, {
          type: 'MATCH_FOUND',
          payload: foundPayload,
        });
      }
    }

    // 2. Lancement effectif de l'instance après le compte à rebours de transition
    setTimeout(() => {
      instance.start();
    }, Matchmaker.COUNTDOWN_TRANSITION_SEC * 1000);
  }

  private broadcastQueueStatus(): void {
    for (const ws of this.connectedClients) {
      if (ws.readyState === ws.OPEN) {
        this.sendQueueStatusTo(ws);
      }
    }
  }

  private sendQueueStatusTo(ws: WebSocket): void {
    const isQueued = this.queue.some((p) => p.ws === ws);
    const payload: QueueStatusPayload = {
      cycleCountdownSec: Math.max(0, this.cycleCountdownSec),
      cycleDurationSec: Matchmaker.CYCLE_DURATION_SEC,
      queuedCount: this.queue.length,
      maxPlayers: Matchmaker.MAX_PLAYERS_PER_INSTANCE,
      isQueued,
      queuedPlayers: this.queue.map((p) => ({
        name: p.name,
        skinId: p.skinId,
        gearScore: p.gearScore,
      })),
    };

    this.sendMessage(ws, {
      type: 'QUEUE_STATUS',
      payload,
    });
  }

  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public getStatus(): { activeInstances: number; queuedPlayers: number; countdown: number } {
    return {
      activeInstances: this.activeInstances.size,
      queuedPlayers: this.queue.length,
      countdown: this.cycleCountdownSec,
    };
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const inst of this.activeInstances.values()) {
      inst.destroy();
    }
    this.activeInstances.clear();
    this.queue.length = 0;
    this.connectedClients.clear();
  }
}
