import type {
  BossDefeatedPayload,
  ChatMessagePayload,
  ChestOpenedPayload,
  ClientMessage,
  DoorOpenedPayload,
  InstancePlayersPayload,
  ItemDroppedPayload,
  ItemPickedUpPayload,
  MatchFoundPayload,
  MatchStartPayload,
  PlayerDiedPayload,
  PlayerExtractedPayload,
  PlayerLeftPayload,
  PlayerPingPayload,
  PlayerShootPayload,
  PlayerUpdatePayload,
  QueueStatusPayload,
  RemoteBossDefeatedPayload,
  RemoteChatMessagePayload,
  RemoteChestOpenedPayload,
  RemoteDoorOpenedPayload,
  RemoteItemDroppedPayload,
  RemoteItemPickedUpPayload,
  RemotePlayerDiedPayload,
  RemotePlayerExtractedPayload,
  RemotePlayerPingPayload,
  RemoteShootPayload,
  ServerMessage,
  SquadSummaryPayload,
} from '../types/network';

export class NetworkClient {
  private static instance: NetworkClient | null = null;

  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;
  private lastQueueStatus: QueueStatusPayload | null = null;

  // Listeners
  private statusListeners: Array<(status: QueueStatusPayload) => void> = [];
  private matchFoundListeners: Array<(data: MatchFoundPayload) => void> = [];
  private matchStartListeners: Array<(data: MatchStartPayload) => void> = [];
  private connectionListeners: Array<(connected: boolean) => void> = [];
  private instancePlayersListeners: Array<(data: InstancePlayersPayload) => void> = [];
  private remoteShootListeners: Array<(data: RemoteShootPayload) => void> = [];
  private playerLeftListeners: Array<(data: PlayerLeftPayload) => void> = [];
  private remoteChestOpenedListeners: Array<(data: RemoteChestOpenedPayload) => void> = [];
  private remoteItemPickedUpListeners: Array<(data: RemoteItemPickedUpPayload) => void> = [];
  private remoteItemDroppedListeners: Array<(data: RemoteItemDroppedPayload) => void> = [];
  private remoteDoorOpenedListeners: Array<(data: RemoteDoorOpenedPayload) => void> = [];
  private remotePlayerExtractedListeners: Array<(data: RemotePlayerExtractedPayload) => void> = [];
  private remotePlayerDiedListeners: Array<(data: RemotePlayerDiedPayload) => void> = [];
  private remoteBossDefeatedListeners: Array<(data: RemoteBossDefeatedPayload) => void> = [];
  private remotePlayerPingListeners: Array<(data: RemotePlayerPingPayload) => void> = [];
  private remoteChatMessageListeners: Array<(data: RemoteChatMessagePayload) => void> = [];
  private squadSummaryListeners: Array<(data: SquadSummaryPayload) => void> = [];

  private constructor() {
    const wsUrlEnv = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) as string | undefined;
    if (wsUrlEnv) {
      this.url = wsUrlEnv;
    } else {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const protocol = isHttps ? 'wss:' : 'ws:';
      const locPort = typeof window !== 'undefined' ? window.location.port : '';
      // En dev Vite local (port 5173), connexion au port 3001 du serveur backend
      // En production, réutilise automatiquement le même port que la page (3001, 80 ou 443)
      const portSuffix = locPort === '5173' ? ':3001' : (locPort ? `:${locPort}` : '');
      this.url = `${protocol}//${host}${portSuffix}`;
    }

    this.connect();
  }

  public static getInstance(): NetworkClient {
    if (!NetworkClient.instance) {
      NetworkClient.instance = new NetworkClient();
    }
    return NetworkClient.instance;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[NetworkClient] Connecté au serveur multijoueur');
        this.notifyConnection(true);
      };

      this.ws.onclose = () => {
        this.notifyConnection(false);
        if (!this.isIntentionalDisconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (e) => {
        console.warn('[NetworkClient] Erreur WebSocket (serveur hors ligne ?)', e);
        this.notifyConnection(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[NetworkClient] Données serveur non reconnues:', err);
        }
      };
    } catch (e) {
      console.warn('[NetworkClient] Impossible d\'initialiser WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'QUEUE_STATUS':
        this.lastQueueStatus = msg.payload;
        for (const listener of this.statusListeners) {
          listener(msg.payload);
        }
        break;

      case 'MATCH_FOUND':
        for (const listener of this.matchFoundListeners) {
          listener(msg.payload);
        }
        break;

      case 'MATCH_START':
        for (const listener of this.matchStartListeners) {
          listener(msg.payload);
        }
        break;

      case 'INSTANCE_PLAYERS':
        for (const listener of this.instancePlayersListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_SHOOT':
        for (const listener of this.remoteShootListeners) {
          listener(msg.payload);
        }
        break;

      case 'PLAYER_LEFT':
        for (const listener of this.playerLeftListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_CHEST_OPENED':
        for (const listener of this.remoteChestOpenedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_ITEM_PICKED_UP':
        for (const listener of this.remoteItemPickedUpListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_ITEM_DROPPED':
        for (const listener of this.remoteItemDroppedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_DOOR_OPENED':
        for (const listener of this.remoteDoorOpenedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_PLAYER_EXTRACTED':
        for (const listener of this.remotePlayerExtractedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_PLAYER_DIED':
        for (const listener of this.remotePlayerDiedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_BOSS_DEFEATED':
        for (const listener of this.remoteBossDefeatedListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_PLAYER_PING':
        for (const listener of this.remotePlayerPingListeners) {
          listener(msg.payload);
        }
        break;

      case 'REMOTE_CHAT_MESSAGE':
        for (const listener of this.remoteChatMessageListeners) {
          listener(msg.payload);
        }
        break;

      case 'SQUAD_SUMMARY':
        for (const listener of this.squadSummaryListeners) {
          listener(msg.payload);
        }
        break;

      case 'PONG':
        // Heartbeat
        break;
    }
  }

  public joinQueue(playerName: string, gearScore: number, skinId?: string): void {
    this.send({
      type: 'JOIN_QUEUE',
      payload: { playerName, gearScore, skinId },
    });
  }

  public leaveQueue(): void {
    this.send({
      type: 'LEAVE_QUEUE',
    });
  }

  public sendPlayerUpdate(payload: PlayerUpdatePayload): void {
    this.send({
      type: 'PLAYER_UPDATE',
      payload,
    });
  }

  public sendPlayerShoot(payload: PlayerShootPayload): void {
    this.send({
      type: 'PLAYER_SHOOT',
      payload,
    });
  }

  public leaveMatch(instanceId: string): void {
    this.send({
      type: 'LEAVE_MATCH',
      payload: { instanceId },
    });
  }

  public sendChestOpened(payload: ChestOpenedPayload): void {
    this.send({
      type: 'CHEST_OPENED',
      payload,
    });
  }

  public sendItemPickedUp(payload: ItemPickedUpPayload): void {
    this.send({
      type: 'ITEM_PICKED_UP',
      payload,
    });
  }

  public sendItemDropped(payload: ItemDroppedPayload): void {
    this.send({
      type: 'ITEM_DROPPED',
      payload,
    });
  }

  public sendDoorOpened(payload: DoorOpenedPayload): void {
    this.send({
      type: 'DOOR_OPENED',
      payload,
    });
  }

  public sendPlayerExtracted(payload: PlayerExtractedPayload): void {
    this.send({
      type: 'PLAYER_EXTRACTED',
      payload,
    });
  }

  public sendPlayerDied(payload: PlayerDiedPayload): void {
    this.send({
      type: 'PLAYER_DIED',
      payload,
    });
  }

  public sendBossDefeated(payload: BossDefeatedPayload): void {
    this.send({
      type: 'BOSS_DEFEATED',
      payload,
    });
  }

  public sendPlayerPing(payload: PlayerPingPayload): void {
    this.send({
      type: 'PLAYER_PING',
      payload,
    });
  }

  public sendChatMessage(payload: ChatMessagePayload): void {
    this.send({
      type: 'CHAT_MESSAGE',
      payload,
    });
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getLastQueueStatus(): QueueStatusPayload | null {
    return this.lastQueueStatus;
  }

  public onQueueStatus(callback: (status: QueueStatusPayload) => void): () => void {
    this.statusListeners.push(callback);
    if (this.lastQueueStatus) callback(this.lastQueueStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== callback);
    };
  }

  public onMatchFound(callback: (data: MatchFoundPayload) => void): () => void {
    this.matchFoundListeners.push(callback);
    return () => {
      this.matchFoundListeners = this.matchFoundListeners.filter((l) => l !== callback);
    };
  }

  public onMatchStart(callback: (data: MatchStartPayload) => void): () => void {
    this.matchStartListeners.push(callback);
    return () => {
      this.matchStartListeners = this.matchStartListeners.filter((l) => l !== callback);
    };
  }

  public onInstancePlayers(callback: (data: InstancePlayersPayload) => void): () => void {
    this.instancePlayersListeners.push(callback);
    return () => {
      this.instancePlayersListeners = this.instancePlayersListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteShoot(callback: (data: RemoteShootPayload) => void): () => void {
    this.remoteShootListeners.push(callback);
    return () => {
      this.remoteShootListeners = this.remoteShootListeners.filter((l) => l !== callback);
    };
  }

  public onPlayerLeft(callback: (data: PlayerLeftPayload) => void): () => void {
    this.playerLeftListeners.push(callback);
    return () => {
      this.playerLeftListeners = this.playerLeftListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteChestOpened(callback: (data: RemoteChestOpenedPayload) => void): () => void {
    this.remoteChestOpenedListeners.push(callback);
    return () => {
      this.remoteChestOpenedListeners = this.remoteChestOpenedListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteItemPickedUp(callback: (data: RemoteItemPickedUpPayload) => void): () => void {
    this.remoteItemPickedUpListeners.push(callback);
    return () => {
      this.remoteItemPickedUpListeners = this.remoteItemPickedUpListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteItemDropped(callback: (data: RemoteItemDroppedPayload) => void): () => void {
    this.remoteItemDroppedListeners.push(callback);
    return () => {
      this.remoteItemDroppedListeners = this.remoteItemDroppedListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteDoorOpened(callback: (data: RemoteDoorOpenedPayload) => void): () => void {
    this.remoteDoorOpenedListeners.push(callback);
    return () => {
      this.remoteDoorOpenedListeners = this.remoteDoorOpenedListeners.filter((l) => l !== callback);
    };
  }

  public onRemotePlayerExtracted(callback: (data: RemotePlayerExtractedPayload) => void): () => void {
    this.remotePlayerExtractedListeners.push(callback);
    return () => {
      this.remotePlayerExtractedListeners = this.remotePlayerExtractedListeners.filter((l) => l !== callback);
    };
  }

  public onRemotePlayerDied(callback: (data: RemotePlayerDiedPayload) => void): () => void {
    this.remotePlayerDiedListeners.push(callback);
    return () => {
      this.remotePlayerDiedListeners = this.remotePlayerDiedListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteBossDefeated(callback: (data: RemoteBossDefeatedPayload) => void): () => void {
    this.remoteBossDefeatedListeners.push(callback);
    return () => {
      this.remoteBossDefeatedListeners = this.remoteBossDefeatedListeners.filter((l) => l !== callback);
    };
  }

  public onRemotePlayerPing(callback: (data: RemotePlayerPingPayload) => void): () => void {
    this.remotePlayerPingListeners.push(callback);
    return () => {
      this.remotePlayerPingListeners = this.remotePlayerPingListeners.filter((l) => l !== callback);
    };
  }

  public onRemoteChatMessage(callback: (data: RemoteChatMessagePayload) => void): () => void {
    this.remoteChatMessageListeners.push(callback);
    return () => {
      this.remoteChatMessageListeners = this.remoteChatMessageListeners.filter((l) => l !== callback);
    };
  }

  public onSquadSummary(callback: (data: SquadSummaryPayload) => void): () => void {
    this.squadSummaryListeners.push(callback);
    return () => {
      this.squadSummaryListeners = this.squadSummaryListeners.filter((l) => l !== callback);
    };
  }

  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.push(callback);
    callback(this.isConnected());
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== callback);
    };
  }

  private notifyConnection(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      listener(connected);
    }
  }

  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
