import WebSocket from 'ws';
import type {
  ClientMessage,
  MatchStartPayload,
  RemoteBossDefeatedPayload,
  RemoteChestOpenedPayload,
  RemoteDoorOpenedPayload,
  RemoteItemDroppedPayload,
  RemoteItemPickedUpPayload,
  RemotePlayerExtractedPayload,
  RemotePlayerPingPayload,
  ServerMessage,
} from '../src/types/network';

async function runTestPhase3() {
  console.log('🧪 Début du test multijoueur Phase 3 (Donjon partagé & Extraction)...');

  const ws1 = new WebSocket('ws://localhost:3001');
  const ws2 = new WebSocket('ws://localhost:3001');

  await Promise.all([
    new Promise<void>((res) => ws1.on('open', () => res())),
    new Promise<void>((res) => ws2.on('open', () => res())),
  ]);

  console.log('✅ Deux WebSockets connectées au serveur.');

  let client1Start: MatchStartPayload | null = null;
  let client2Start: MatchStartPayload | null = null;

  let client2ReceivedChest: RemoteChestOpenedPayload | null = null;
  let client2ReceivedItemPickup: RemoteItemPickedUpPayload | null = null;
  let client2ReceivedItemDrop: RemoteItemDroppedPayload | null = null;
  let client2ReceivedDoorOpen: RemoteDoorOpenedPayload | null = null;
  let client2ReceivedPing: RemotePlayerPingPayload | null = null;
  let client1ReceivedExtraction: RemotePlayerExtractedPayload | null = null;
  let client2ReceivedBossDefeat: RemoteBossDefeatedPayload | null = null;

  ws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client1Start = msg.payload;
    } else if (msg.type === 'REMOTE_PLAYER_EXTRACTED') {
      client1ReceivedExtraction = msg.payload;
      console.log('🏆 Client 1 a reçu REMOTE_PLAYER_EXTRACTED pour:', msg.payload.playerName);
    }
  });

  ws2.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client2Start = msg.payload;
    } else if (msg.type === 'REMOTE_CHEST_OPENED') {
      client2ReceivedChest = msg.payload;
      console.log('🎁 Client 2 a reçu REMOTE_CHEST_OPENED à:', msg.payload.x, msg.payload.y);
    } else if (msg.type === 'REMOTE_ITEM_PICKED_UP') {
      client2ReceivedItemPickup = msg.payload;
      console.log('💎 Client 2 a reçu REMOTE_ITEM_PICKED_UP:', msg.payload.itemName);
    } else if (msg.type === 'REMOTE_ITEM_DROPPED') {
      client2ReceivedItemDrop = msg.payload;
      console.log('📦 Client 2 a reçu REMOTE_ITEM_DROPPED:', msg.payload.item.name);
    } else if (msg.type === 'REMOTE_DOOR_OPENED') {
      client2ReceivedDoorOpen = msg.payload;
      console.log('🚪 Client 2 a reçu REMOTE_DOOR_OPENED case:', msg.payload.tileX, msg.payload.tileY);
    } else if (msg.type === 'REMOTE_PLAYER_PING') {
      client2ReceivedPing = msg.payload;
      console.log('📍 Client 2 a reçu REMOTE_PLAYER_PING:', msg.payload.label);
    } else if (msg.type === 'REMOTE_BOSS_DEFEATED') {
      client2ReceivedBossDefeat = msg.payload;
      console.log('👑 Client 2 a reçu REMOTE_BOSS_DEFEATED:', msg.payload.bossName);
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

  const startTime = Date.now();
  while (!client1Start || !client2Start) {
    if (Date.now() - startTime > 70000) {
      throw new Error('Délai dépassé pour le lancement du convoi !');
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const instId = (client1Start as MatchStartPayload).instanceId;
  console.log(`✅ Convoi lancé ! Instance: ${instId}`);

  // 2. Client 1 ouvre un coffre
  ws1.send(
    JSON.stringify({
      type: 'CHEST_OPENED',
      payload: {
        instanceId: instId,
        x: 12.5,
        y: 18.5,
        isMimic: false,
        items: [
          {
            id: 'hat_wizard_epic',
            instanceId: 'item_test_1',
            name: 'Chapeau des Arcanes',
            slot: 'hat',
            rarity: 'epic',
            stats: { magicPower: 25, defense: 10 },
            flavor: 'Test',
          },
        ],
        dropPositions: [{ startX: 12.5, startY: 18.5, targetX: 13.0, targetY: 19.0 }],
      },
    } as ClientMessage)
  );

  const chestWait = Date.now();
  while (!client2ReceivedChest && Date.now() - chestWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedChest) throw new Error('Client 2 n\'a pas reçu REMOTE_CHEST_OPENED !');
  console.log('✅ Synchronisation de l\'ouverture de coffre validée !');

  // 3. Client 1 ramasse l'objet
  ws1.send(
    JSON.stringify({
      type: 'ITEM_PICKED_UP',
      payload: {
        instanceId: instId,
        itemInstanceId: 'item_test_1',
        itemName: 'Chapeau des Arcanes',
        x: 13.0,
        y: 19.0,
      },
    } as ClientMessage)
  );

  const pickupWait = Date.now();
  while (!client2ReceivedItemPickup && Date.now() - pickupWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedItemPickup) throw new Error('Client 2 n\'a pas reçu REMOTE_ITEM_PICKED_UP !');
  console.log('✅ Synchronisation du ramassage d\'objet validée !');

  // 4. Client 1 jette / remplace un objet au sol
  ws1.send(
    JSON.stringify({
      type: 'ITEM_DROPPED',
      payload: {
        instanceId: instId,
        item: {
          id: 'hat_apprentice',
          instanceId: 'item_test_old',
          name: 'Chapeau d\'Apprenti',
          slot: 'hat',
          rarity: 'common',
          stats: { magicPower: 5 },
          flavor: 'Vieux chapeau',
        },
        startX: 13.0,
        startY: 19.0,
        targetX: 13.5,
        targetY: 19.5,
      },
    } as ClientMessage)
  );

  const dropWait = Date.now();
  while (!client2ReceivedItemDrop && Date.now() - dropWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedItemDrop) throw new Error('Client 2 n\'a pas reçu REMOTE_ITEM_DROPPED !');
  console.log('✅ Synchronisation du butin déposé au sol validée !');

  // 5. Client 1 ouvre une porte avec clé
  ws1.send(
    JSON.stringify({
      type: 'DOOR_OPENED',
      payload: {
        instanceId: instId,
        tileX: 15,
        tileY: 20,
      },
    } as ClientMessage)
  );

  const doorWait = Date.now();
  while (!client2ReceivedDoorOpen && Date.now() - doorWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedDoorOpen) throw new Error('Client 2 n\'a pas reçu REMOTE_DOOR_OPENED !');
  console.log('✅ Synchronisation de l\'ouverture de porte validée !');

  // 6. Client 1 place un signal tactique (touche T)
  ws1.send(
    JSON.stringify({
      type: 'PLAYER_PING',
      payload: {
        instanceId: instId,
        x: 16.0,
        y: 22.0,
        label: 'Ennemis ici !',
      },
    } as ClientMessage)
  );

  const pingWait = Date.now();
  while (!client2ReceivedPing && Date.now() - pingWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedPing) throw new Error('Client 2 n\'a pas reçu REMOTE_PLAYER_PING !');
  console.log('✅ Synchronisation du signal tactique (Ping) validée !');

  // 7. Client 2 s'extrait par un portail
  ws2.send(
    JSON.stringify({
      type: 'PLAYER_EXTRACTED',
      payload: {
        instanceId: instId,
        portalName: 'Portail des Crypteurs',
      },
    } as ClientMessage)
  );

  const extractWait = Date.now();
  while (!client1ReceivedExtraction && Date.now() - extractWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client1ReceivedExtraction) throw new Error('Client 1 n\'a pas reçu REMOTE_PLAYER_EXTRACTED !');
  console.log('✅ Synchronisation de l\'extraction validée !');

  // 8. Client 1 terrasse le Boss du Sanctuaire
  ws1.send(
    JSON.stringify({
      type: 'BOSS_DEFEATED',
      payload: {
        instanceId: instId,
        bossName: 'Carrot Cake King',
      },
    } as ClientMessage)
  );

  const bossWait = Date.now();
  while (!client2ReceivedBossDefeat && Date.now() - bossWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!client2ReceivedBossDefeat) throw new Error('Client 2 n\'a pas reçu REMOTE_BOSS_DEFEATED !');
  console.log('✅ Synchronisation de la chute du Boss & ouverture du Portail Royal validée !');

  ws1.close();
  ws2.close();

  console.log('🎉 TOUS LES TESTS DE LA PHASE 3 MULTIJOUEUR ONT RÉUSSI AVEC SUCCÈS !');
}

runTestPhase3().catch((err) => {
  console.error('❌ Échec du test Phase 3:', err);
  process.exit(1);
});
