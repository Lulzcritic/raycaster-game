import WebSocket from 'ws';
import type {
  ClientMessage,
  MatchStartPayload,
  PlayerLeftPayload,
  RemoteShootPayload,
  ServerMessage,
} from '../src/types/network';

async function runTest() {
  console.log('🧪 Début du test multijoueur Phase 2...');

  const ws1 = new WebSocket('ws://localhost:3001');
  const ws2 = new WebSocket('ws://localhost:3001');

  await Promise.all([
    new Promise<void>((res) => ws1.on('open', () => res())),
    new Promise<void>((res) => ws2.on('open', () => res())),
  ]);

  console.log('✅ Deux WebSockets connectées au serveur.');

  let client1Start: MatchStartPayload | null = null;
  let client2Start: MatchStartPayload | null = null;
  let client2ReceivedShoot: RemoteShootPayload | null = null;
  let client1ReceivedHpUpdate: number | null = null;
  let client1ReceivedPlayerLeft: PlayerLeftPayload | null = null;

  ws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client1Start = msg.payload;
      console.log('🎮 Client 1 reçu MATCH_START:', msg.payload.instanceId);
    } else if (msg.type === 'INSTANCE_PLAYERS') {
      const p2 = msg.payload.players.find((p) => p.name === 'Lord Gourmand');
      if (p2 && p2.hp === 55) {
        client1ReceivedHpUpdate = p2.hp;
      }
    } else if (msg.type === 'PLAYER_LEFT') {
      client1ReceivedPlayerLeft = msg.payload;
      console.log('👋 Client 1 a reçu PLAYER_LEFT pour:', msg.payload.playerId);
    }
  });

  let client2ReceivedPlayer1Pos = false;
  ws2.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client2Start = msg.payload;
      console.log('🎮 Client 2 reçu MATCH_START:', msg.payload.instanceId);
    } else if (msg.type === 'INSTANCE_PLAYERS') {
      const p1 = msg.payload.players.find((p) => p.name === 'Lord Énigmatique');
      if (p1 && Math.abs(p1.x - 14.5) < 0.01) {
        client2ReceivedPlayer1Pos = true;
      }
    } else if (msg.type === 'REMOTE_SHOOT') {
      client2ReceivedShoot = msg.payload;
      console.log('🔥 Client 2 a reçu REMOTE_SHOOT:', msg.payload.spellType, 'dégâts:', msg.payload.damage);
    }
  });

  // 1. Inscription dans la file d'attente
  ws1.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Énigmatique', gearScore: 120, skinId: 'puzzle_lord' },
    } as ClientMessage)
  );

  ws2.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Gourmand', gearScore: 95, skinId: 'gouter_lord' },
    } as ClientMessage)
  );

  console.log('⏳ Attente du départ du convoi...');

  // Attendre le lancement du convoi (max 65s)
  const startTime = Date.now();
  while (!client1Start || !client2Start) {
    if (Date.now() - startTime > 70000) {
      throw new Error('Délai dépassé pour le lancement du convoi !');
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('✅ Instance démarrée avec succès pour les 2 joueurs !');
  console.log(`   Instance ID: ${client1Start.instanceId}`);
  console.log(`   Map Seed commune: ${client1Start.mapSeed}`);
  console.log(
    `   Joueurs dans l'instance: ${client1Start.players
      .map((p) => `${p.name} (${p.skinId}, GS ${p.gearScore}, Crypte ${p.spawnIndex})`)
      .join(', ')}`
  );

  const instId = client1Start.instanceId;

  // 2. Client 1 envoie une mise à jour de position (20 Hz tick)
  ws1.send(
    JSON.stringify({
      type: 'PLAYER_UPDATE',
      payload: {
        instanceId: instId,
        x: 14.5,
        y: 22.3,
        angle: 1.57,
        isMoving: true,
        isAttacking: false,
        hp: 100,
        maxHp: 100,
      },
    } as ClientMessage)
  );

  // Attente réception de la position par Client 2
  const posWaitStart = Date.now();
  while (!client2ReceivedPlayer1Pos && Date.now() - posWaitStart < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client2ReceivedPlayer1Pos) {
    throw new Error('Client 2 n\'a pas reçu la position de Client 1 !');
  }
  console.log('✅ Synchronisation de position reçue à 20 Hz par Client 2 !');

  // 3. Client 1 tire une boule de feu
  ws1.send(
    JSON.stringify({
      type: 'PLAYER_SHOOT',
      payload: {
        instanceId: instId,
        spellType: 'fireball',
        originX: 14.5,
        originY: 22.3,
        angle: 1.57,
        damage: 45,
      },
    } as ClientMessage)
  );

  // Attente réception du tir par Client 2
  const shootWaitStart = Date.now();
  while (!client2ReceivedShoot && Date.now() - shootWaitStart < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client2ReceivedShoot || client2ReceivedShoot.spellType !== 'fireball') {
    throw new Error('Client 2 n\'a pas reçu le tir de boule de feu !');
  }
  console.log('✅ Sort de boule de feu synchronisé avec succès vers Client 2 !');

  // 4. Client 2 prend 45 dégâts et envoie son nouvel HP (55)
  ws2.send(
    JSON.stringify({
      type: 'PLAYER_UPDATE',
      payload: {
        instanceId: instId,
        x: 14.5,
        y: 25.0,
        angle: 3.14,
        isMoving: false,
        isAttacking: false,
        hp: 55,
        maxHp: 100,
      },
    } as ClientMessage)
  );

  const hpWaitStart = Date.now();
  while (client1ReceivedHpUpdate !== 55 && Date.now() - hpWaitStart < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (client1ReceivedHpUpdate !== 55) {
    throw new Error('Client 1 n\'a pas reçu la mise à jour des PV de Client 2 !');
  }
  console.log('✅ PV et barre de vie de Client 2 (55 / 100) synchronisés vers Client 1 !');

  // 5. Client 2 quitte la partie
  ws2.send(
    JSON.stringify({
      type: 'LEAVE_MATCH',
      payload: { instanceId: instId },
    } as ClientMessage)
  );

  const leaveWaitStart = Date.now();
  while (!client1ReceivedPlayerLeft && Date.now() - leaveWaitStart < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client1ReceivedPlayerLeft) {
    throw new Error('Client 1 n\'a pas reçu la notification PLAYER_LEFT !');
  }
  console.log('✅ Signal PLAYER_LEFT reçu par Client 1 lors du départ de Client 2 !');

  ws1.close();
  ws2.close();

  console.log('🎉 TOUS LES TESTS DE LA PHASE 2 MULTIJOUEUR ONT RÉUSSI !');
}

runTest().catch((err) => {
  console.error('❌ Échec du test:', err);
  process.exit(1);
});
