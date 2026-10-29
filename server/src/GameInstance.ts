import type { WebSocket } from 'ws';
import type {
  BossDefeatedPayload,
  ChatMessagePayload,
  ChestOpenedPayload,
  DoorOpenedPayload,
  InstancePlayersPayload,
  ItemDroppedPayload,
  ItemPickedUpPayload,
  MatchPlayerInfo,
  MatchStartPayload,
  PlayerDiedPayload,
  PlayerExtractedPayload,
  PlayerPingPayload,
  PlayerShootPayload,
  PlayerUpdatePayload,
  RemoteBossDefeatedPayload,
  RemoteChatMessagePayload,
  RemoteChestOpenedPayload,
  RemoteDoorOpenedPayload,
  RemoteItemDroppedPayload,
  RemoteItemPickedUpPayload,
  RemotePlayerData,
  RemotePlayerDiedPayload,
  RemotePlayerExtractedPayload,
  RemotePlayerPingPayload,
  RemoteShootPayload,
  SquadMemberSummary,
  SquadSummaryPayload,
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
  status: 'in_raid' | 'extracted' | 'dead';
  portalName?: string;
  coins: number;
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
    this.broadcastSquadSummary();
  }

  private tick(): void {
    if (!this.isActive || this.players.length === 0) return;

    // Seuls les joueurs vivants et toujours en raid sont diffusés pour l'avatar 3D
    const livingPlayers = this.players.filter((p) => p.status === 'in_raid' && p.hp > 0);

    const remotePlayers: RemotePlayerData[] = livingPlayers.map((p) => ({
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

  private broadcastToOthers(senderWs: WebSocket, message: string): void {
    for (const p of this.players) {
      if (p.ws !== senderWs && p.ws.readyState === p.ws.OPEN) {
        p.ws.send(message);
      }
    }
  }

  private broadcastToAll(message: string): void {
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

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_SHOOT', payload: remoteShootPayload }));
  }

  public handleChestOpened(ws: WebSocket, payload: ChestOpenedPayload): void {
    const opener = this.players.find((p) => p.ws === ws);
    if (!opener) return;

    const remotePayload: RemoteChestOpenedPayload = {
      openerId: opener.id,
      openerName: opener.name,
      x: payload.x,
      y: payload.y,
      isMimic: payload.isMimic,
      items: payload.items,
      dropPositions: payload.dropPositions,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_CHEST_OPENED', payload: remotePayload }));
  }

  public handleItemPickedUp(ws: WebSocket, payload: ItemPickedUpPayload): void {
    const picker = this.players.find((p) => p.ws === ws);
    if (!picker) return;

    const remotePayload: RemoteItemPickedUpPayload = {
      pickerId: picker.id,
      pickerName: picker.name,
      itemInstanceId: payload.itemInstanceId,
      itemName: payload.itemName,
      x: payload.x,
      y: payload.y,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_ITEM_PICKED_UP', payload: remotePayload }));
  }

  public handleItemDropped(ws: WebSocket, payload: ItemDroppedPayload): void {
    const dropper = this.players.find((p) => p.ws === ws);
    if (!dropper) return;

    const remotePayload: RemoteItemDroppedPayload = {
      dropperId: dropper.id,
      dropperName: dropper.name,
      item: payload.item,
      startX: payload.startX,
      startY: payload.startY,
      targetX: payload.targetX,
      targetY: payload.targetY,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_ITEM_DROPPED', payload: remotePayload }));
  }

  public handleDoorOpened(ws: WebSocket, payload: DoorOpenedPayload): void {
    const opener = this.players.find((p) => p.ws === ws);
    if (!opener) return;

    const remotePayload: RemoteDoorOpenedPayload = {
      openerId: opener.id,
      openerName: opener.name,
      tileX: payload.tileX,
      tileY: payload.tileY,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_DOOR_OPENED', payload: remotePayload }));
  }

  public handlePlayerExtracted(ws: WebSocket, payload: PlayerExtractedPayload): void {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    player.status = 'extracted';
    player.portalName = payload.portalName;
    player.coins = payload.coins ?? player.coins;

    const remotePayload: RemotePlayerExtractedPayload = {
      playerId: player.id,
      playerName: player.name,
      portalName: payload.portalName,
      coins: player.coins,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_PLAYER_EXTRACTED', payload: remotePayload }));
    this.broadcastSquadSummary();
  }

  public handlePlayerDied(ws: WebSocket, payload: PlayerDiedPayload): void {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    player.status = 'dead';
    player.hp = 0;

    const remotePayload: RemotePlayerDiedPayload = {
      playerId: player.id,
      playerName: player.name,
      x: payload.x,
      y: payload.y,
      droppedItems: payload.droppedItems,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_PLAYER_DIED', payload: remotePayload }));
    this.broadcastSquadSummary();
  }

  public handleBossDefeated(ws: WebSocket, payload: BossDefeatedPayload): void {
    const remotePayload: RemoteBossDefeatedPayload = {
      bossName: payload.bossName,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_BOSS_DEFEATED', payload: remotePayload }));
  }

  public handlePlayerPing(ws: WebSocket, payload: PlayerPingPayload): void {
    const sender = this.players.find((p) => p.ws === ws);
    if (!sender) return;

    const remotePayload: RemotePlayerPingPayload = {
      senderId: sender.id,
      senderName: sender.name,
      x: payload.x,
      y: payload.y,
      label: payload.label,
    };

    this.broadcastToOthers(ws, JSON.stringify({ type: 'REMOTE_PLAYER_PING', payload: remotePayload }));
  }

  public handleChatMessage(ws: WebSocket, payload: ChatMessagePayload): void {
    const sender = this.players.find((p) => p.ws === ws);
    if (!sender) return;

    const remotePayload: RemoteChatMessagePayload = {
      senderId: sender.id,
      senderName: sender.name,
      text: payload.text,
      timestamp: Date.now(),
      isSystem: false,
    };

    // Le message de chat est diffusé à TOUS les joueurs (y compris l'expéditeur pour confirmation)
    this.broadcastToAll(JSON.stringify({ type: 'REMOTE_CHAT_MESSAGE', payload: remotePayload }));
  }

  public broadcastSquadSummary(): void {
    const squadMembers: SquadMemberSummary[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      skinId: p.skinId,
      gearScore: p.gearScore,
      status: p.status,
      portalName: p.portalName,
      coins: p.coins,
    }));

    const payload: SquadSummaryPayload = { players: squadMembers };
    this.broadcastToAll(JSON.stringify({ type: 'SQUAD_SUMMARY', payload }));
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
      this.broadcastSquadSummary();
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
