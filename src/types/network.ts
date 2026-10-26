import type { EquipmentItem } from './index';

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
  | 'LEAVE_MATCH'
  | 'CHEST_OPENED'
  | 'ITEM_PICKED_UP'
  | 'ITEM_DROPPED'
  | 'DOOR_OPENED'
  | 'PLAYER_EXTRACTED'
  | 'PLAYER_DIED'
  | 'BOSS_DEFEATED'
  | 'PLAYER_PING'
  | 'CHAT_MESSAGE';

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

export interface ChestOpenedPayload {
  instanceId: string;
  x: number;
  y: number;
  isMimic: boolean;
  items: EquipmentItem[];
  dropPositions: Array<{ startX: number; startY: number; targetX: number; targetY: number }>;
}

export interface ItemPickedUpPayload {
  instanceId: string;
  itemInstanceId: string;
  itemName: string;
  x: number;
  y: number;
}

export interface ItemDroppedPayload {
  instanceId: string;
  item: EquipmentItem;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export interface DoorOpenedPayload {
  instanceId: string;
  tileX: number;
  tileY: number;
}

export interface PlayerExtractedPayload {
  instanceId: string;
  portalName: string;
  coins?: number;
}

export interface PlayerDiedPayload {
  instanceId: string;
  x: number;
  y: number;
  droppedItems: EquipmentItem[];
}

export interface BossDefeatedPayload {
  instanceId: string;
  bossName: string;
}

export interface PlayerPingPayload {
  instanceId: string;
  x: number;
  y: number;
  label: string;
}

export interface ChatMessagePayload {
  instanceId: string;
  text: string;
}

export type ClientMessage =
  | { type: 'JOIN_QUEUE'; payload: JoinQueuePayload }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'PING'; payload: { timestamp: number } }
  | { type: 'PLAYER_UPDATE'; payload: PlayerUpdatePayload }
  | { type: 'PLAYER_SHOOT'; payload: PlayerShootPayload }
  | { type: 'LEAVE_MATCH'; payload: LeaveMatchPayload }
  | { type: 'CHEST_OPENED'; payload: ChestOpenedPayload }
  | { type: 'ITEM_PICKED_UP'; payload: ItemPickedUpPayload }
  | { type: 'ITEM_DROPPED'; payload: ItemDroppedPayload }
  | { type: 'DOOR_OPENED'; payload: DoorOpenedPayload }
  | { type: 'PLAYER_EXTRACTED'; payload: PlayerExtractedPayload }
  | { type: 'PLAYER_DIED'; payload: PlayerDiedPayload }
  | { type: 'BOSS_DEFEATED'; payload: BossDefeatedPayload }
  | { type: 'PLAYER_PING'; payload: PlayerPingPayload }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessagePayload };

export type ServerMessageType =
  | 'QUEUE_STATUS'
  | 'MATCH_FOUND'
  | 'MATCH_START'
  | 'INSTANCE_PLAYERS'
  | 'REMOTE_SHOOT'
  | 'PLAYER_LEFT'
  | 'REMOTE_CHEST_OPENED'
  | 'REMOTE_ITEM_PICKED_UP'
  | 'REMOTE_ITEM_DROPPED'
  | 'REMOTE_DOOR_OPENED'
  | 'REMOTE_PLAYER_EXTRACTED'
  | 'REMOTE_PLAYER_DIED'
  | 'REMOTE_BOSS_DEFEATED'
  | 'REMOTE_PLAYER_PING'
  | 'REMOTE_CHAT_MESSAGE'
  | 'SQUAD_SUMMARY'
  | 'PONG'
  | 'ERROR';

export interface QueueStatusPayload {
  cycleCountdownSec: number;
  cycleDurationSec: number;
  queuedCount: number;
  maxPlayers: number;
  isQueued: boolean;
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

export interface RemoteChestOpenedPayload {
  openerId: string;
  openerName: string;
  x: number;
  y: number;
  isMimic: boolean;
  items: EquipmentItem[];
  dropPositions: Array<{ startX: number; startY: number; targetX: number; targetY: number }>;
}

export interface RemoteItemPickedUpPayload {
  pickerId: string;
  pickerName: string;
  itemInstanceId: string;
  itemName: string;
  x: number;
  y: number;
}

export interface RemoteItemDroppedPayload {
  dropperId: string;
  dropperName: string;
  item: EquipmentItem;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export interface RemoteDoorOpenedPayload {
  openerId: string;
  openerName: string;
  tileX: number;
  tileY: number;
}

export interface RemotePlayerExtractedPayload {
  playerId: string;
  playerName: string;
  portalName: string;
  coins?: number;
}

export interface RemotePlayerDiedPayload {
  playerId: string;
  playerName: string;
  x: number;
  y: number;
  droppedItems: EquipmentItem[];
}

export interface RemoteBossDefeatedPayload {
  bossName: string;
}

export interface RemotePlayerPingPayload {
  senderId: string;
  senderName: string;
  x: number;
  y: number;
  label: string;
}

export interface RemoteChatMessagePayload {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  badgeColor?: string;
  isSystem?: boolean;
}

export interface SquadMemberSummary {
  id: string;
  name: string;
  skinId: string;
  gearScore: number;
  status: 'in_raid' | 'extracted' | 'dead';
  portalName?: string;
  coins: number;
}

export interface SquadSummaryPayload {
  players: SquadMemberSummary[];
}

export type ServerMessage =
  | { type: 'QUEUE_STATUS'; payload: QueueStatusPayload }
  | { type: 'MATCH_FOUND'; payload: MatchFoundPayload }
  | { type: 'MATCH_START'; payload: MatchStartPayload }
  | { type: 'INSTANCE_PLAYERS'; payload: InstancePlayersPayload }
  | { type: 'REMOTE_SHOOT'; payload: RemoteShootPayload }
  | { type: 'PLAYER_LEFT'; payload: PlayerLeftPayload }
  | { type: 'REMOTE_CHEST_OPENED'; payload: RemoteChestOpenedPayload }
  | { type: 'REMOTE_ITEM_PICKED_UP'; payload: RemoteItemPickedUpPayload }
  | { type: 'REMOTE_ITEM_DROPPED'; payload: RemoteItemDroppedPayload }
  | { type: 'REMOTE_DOOR_OPENED'; payload: RemoteDoorOpenedPayload }
  | { type: 'REMOTE_PLAYER_EXTRACTED'; payload: RemotePlayerExtractedPayload }
  | { type: 'REMOTE_PLAYER_DIED'; payload: RemotePlayerDiedPayload }
  | { type: 'REMOTE_BOSS_DEFEATED'; payload: RemoteBossDefeatedPayload }
  | { type: 'REMOTE_PLAYER_PING'; payload: RemotePlayerPingPayload }
  | { type: 'REMOTE_CHAT_MESSAGE'; payload: RemoteChatMessagePayload }
  | { type: 'SQUAD_SUMMARY'; payload: SquadSummaryPayload }
  | { type: 'PONG'; payload: { timestamp: number } }
  | { type: 'ERROR'; payload: { message: string } };
