export interface MatchPlayerInfo {
  id: string;
  name: string;
  skinId: string;
  gearScore: number;
  spawnIndex: number; // 0, 1, 2 ou 3 (correspond aux 4 cryptes aux coins de la Citadelle)
}

export type ClientMessageType =
  | 'JOIN_QUEUE'
  | 'LEAVE_QUEUE'
  | 'PING'
  | 'PLAYER_UPDATE'
  | 'PLAYER_SHOOT'
  | 'LEAVE_MATCH';

export interface JoinQueuePayload {
  playerName: string;
  gearScore: number;
  skinId?: string;
}

export interface PlayerUpdatePayload {
  instanceId: string;
  x: number;
  y: number;
  angle: number;
  isMoving: boolean;
  isAttacking: boolean;
  hp: number;
  maxHp: number;
}

export interface PlayerShootPayload {
  instanceId: string;
  spellType: 'fireball' | 'purple_orb';
  originX: number;
  originY: number;
  angle: number;
  damage: number;
}

export interface LeaveMatchPayload {
  instanceId: string;
}

export type ClientMessage =
  | { type: 'JOIN_QUEUE'; payload: JoinQueuePayload }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'PING'; payload: { timestamp: number } }
  | { type: 'PLAYER_UPDATE'; payload: PlayerUpdatePayload }
  | { type: 'PLAYER_SHOOT'; payload: PlayerShootPayload }
  | { type: 'LEAVE_MATCH'; payload: LeaveMatchPayload };

export type ServerMessageType =
  | 'QUEUE_STATUS'
  | 'MATCH_FOUND'
  | 'MATCH_START'
  | 'INSTANCE_PLAYERS'
  | 'REMOTE_SHOOT'
  | 'PLAYER_LEFT'
  | 'PONG'
  | 'ERROR';

export interface QueueStatusPayload {
  cycleCountdownSec: number; // Secondes restantes avant le lancement du prochain convoi (ex: 42s)
  cycleDurationSec: number;  // Durée totale du cycle (60s)
  queuedCount: number;       // Nombre de joueurs actuellement en attente
  maxPlayers: number;        // Taille maximum d'une escouade (4)
  isQueued: boolean;         // Si le client actuel est inscrit dans la file
  queuedPlayers: Array<{ name: string; gearScore: number; skinId?: string }>;
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

export interface RemotePlayerData {
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
}

export interface InstancePlayersPayload {
  players: RemotePlayerData[];
}

export interface RemoteShootPayload {
  shooterId: string;
  spellType: 'fireball' | 'purple_orb';
  originX: number;
  originY: number;
  angle: number;
  damage: number;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export type ServerMessage =
  | { type: 'QUEUE_STATUS'; payload: QueueStatusPayload }
  | { type: 'MATCH_FOUND'; payload: MatchFoundPayload }
  | { type: 'MATCH_START'; payload: MatchStartPayload }
  | { type: 'INSTANCE_PLAYERS'; payload: InstancePlayersPayload }
  | { type: 'REMOTE_SHOOT'; payload: RemoteShootPayload }
  | { type: 'PLAYER_LEFT'; payload: PlayerLeftPayload }
  | { type: 'PONG'; payload: { timestamp: number } }
  | { type: 'ERROR'; payload: { message: string } };
