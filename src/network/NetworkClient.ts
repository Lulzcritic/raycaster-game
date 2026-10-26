import type {
  ClientMessage,
  MatchFoundPayload,
  MatchStartPayload,
  QueueStatusPayload,
  ServerMessage,
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

  private constructor() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = isHttps ? 'wss:' : 'ws:';
    // Port 3001 par défaut pour le serveur multijoueur
    this.url = `${protocol}//${host}:3001`;

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

      case 'PONG':
        // Heartbeat
        break;
    }
  }

  public joinQueue(playerName: string, gearScore: number): void {
    this.send({
      type: 'JOIN_QUEUE',
      payload: { playerName, gearScore },
    });
  }

  public leaveQueue(): void {
    this.send({
      type: 'LEAVE_QUEUE',
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
