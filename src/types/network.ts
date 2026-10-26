export interface MatchPlayerInfo {
  id: string;
  name: string;
  gearScore: number;
  spawnIndex: number; // 0, 1, 2 ou 3 (correspond aux 4 cryptes aux coins de la Citadelle)
}

export type ClientMessageType =
  | 'JOIN_QUEUE'
  | 'LEAVE_QUEUE'
  | 'PING';

export interface JoinQueuePayload {
  playerName: string;
  gearScore: number;
}

export type ClientMessage =
  | { type: 'JOIN_QUEUE'; payload: JoinQueuePayload }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'PING'; payload: { timestamp: number } };

export type ServerMessageType =
  | 'QUEUE_STATUS'
  | 'MATCH_FOUND'
  | 'MATCH_START'
  | 'PONG'
  | 'ERROR';

export interface QueueStatusPayload {
  cycleCountdownSec: number; // Secondes restantes avant le lancement du prochain convoi (ex: 42s)
  cycleDurationSec: number;  // Durée totale du cycle (60s)
  queuedCount: number;       // Nombre de joueurs actuellement en attente
  maxPlayers: number;        // Taille maximum d'une escouade (4)
  isQueued: boolean;         // Si le client actuel est inscrit dans la file
  queuedPlayers: Array<{ name: string; gearScore: number }>;
}

export interface MatchFoundPayload {
  instanceId: string;
  mapSeed: number;
  playerIndex: number;
  totalPlayers: number;
  spawnIndex: number;
  countdownSec: number;
}

export interface MatchStartPayload {
  instanceId: string;
  mapSeed: number;
  playerIndex: number;
  spawnIndex: number;
  players: MatchPlayerInfo[];
}

export type ServerMessage =
  | { type: 'QUEUE_STATUS'; payload: QueueStatusPayload }
  | { type: 'MATCH_FOUND'; payload: MatchFoundPayload }
  | { type: 'MATCH_START'; payload: MatchStartPayload }
  | { type: 'PONG'; payload: { timestamp: number } }
  | { type: 'ERROR'; payload: { message: string } };
