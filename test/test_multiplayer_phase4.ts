import WebSocket from 'ws';
import type {
  ClientMessage,
  MatchStartPayload,
  RemoteChatMessagePayload,
  ServerMessage,
  SquadSummaryPayload,
} from '../src/types/network';

async function runTestPhase4() {
  console.log("🧪 Début du test multijoueur Phase 4 (Chat en direct, Cadre d'escouade & Bilan)...");

  const ws1 = new WebSocket('ws://localhost:3001');
  const ws2 = new WebSocket('ws://localhost:3001');

  await Promise.all([
    new Promise<void>((res) => ws1.on('open', () => res())),
    new Promise<void>((res) => ws2.on('open', () => res())),
  ]);

  console.log('✅ Deux WebSockets connectées au serveur.');

  let client1Start: MatchStartPayload | null = null;
  let client2Start: MatchStartPayload | null = null;

  let client1InitialSummary: SquadSummaryPayload | null = null;
  let client2InitialSummary: SquadSummaryPayload | null = null;

  let client1ReceivedChat: RemoteChatMessagePayload | null = null;
  let client2ReceivedChat: RemoteChatMessagePayload | null = null;

  let client1SummaryAfterExtract: SquadSummaryPayload | null = null;
  let client2SummaryAfterDeath: SquadSummaryPayload | null = null;

  ws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client1Start = msg.payload;
    } else if (msg.type === 'SQUAD_SUMMARY') {
      if (!client1InitialSummary) {
        client1InitialSummary = msg.payload;
        console.log("🛡️ Client 1 a reçu l'état initial de l'escouade:", msg.payload.players.length, 'membres.');
      } else if (msg.payload.players.some((p) => p.status === 'extracted')) {
        client1SummaryAfterExtract = msg.payload;
        console.log("🏆 Client 1 a reçu le bilan mis à jour avec extraction d'un allié.");
      }
    } else if (msg.type === 'REMOTE_CHAT_MESSAGE') {
      client1ReceivedChat = msg.payload;
      console.log(`💬 Client 1 a reçu le message de [${msg.payload.senderName}]: "${msg.payload.text}"`);
    }
  });

  ws2.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'MATCH_START') {
      client2Start = msg.payload;
    } else if (msg.type === 'SQUAD_SUMMARY') {
      if (!client2InitialSummary) {
        client2InitialSummary = msg.payload;
        console.log("🛡️ Client 2 a reçu l'état initial de l'escouade:", msg.payload.players.length, 'membres.');
      } else if (msg.payload.players.some((p) => p.status === 'dead')) {
        client2SummaryAfterDeath = msg.payload;
        console.log("💀 Client 2 a reçu le bilan mis à jour avec la mort d'un allié.");
      }
    } else if (msg.type === 'REMOTE_CHAT_MESSAGE') {
      client2ReceivedChat = msg.payload;
      console.log(`💬 Client 2 a reçu le message de [${msg.payload.senderName}]: "${msg.payload.text}"`);
    }
  });

  // 1. Inscription dans la file d'attente
  ws1.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Mage Arcaniste', gearScore: 140, skinId: 'puzzle_lord' },
    } as ClientMessage)
  );

  ws2.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Chevalier du Crépuscule', gearScore: 110, skinId: 'gouter_lord' },
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

  // Attente de l'état initial de l'escouade
  const summaryWait = Date.now();
  while ((!client1InitialSummary || !client2InitialSummary) && Date.now() - summaryWait < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client1InitialSummary || client1InitialSummary.players.length !== 2) {
    throw new Error("L'escouade initiale reçue par Client 1 est incomplète !");
  }
  console.log('✅ Validation SQUAD_SUMMARY initial : 2 membres en vie en donjon (in_raid).');

  // 2. Client 1 envoie un message dans le chat d'escouade
  console.log('💬 Client 1 envoie un message dans le chat...');
  ws1.send(
    JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: {
        instanceId: instId,
        text: 'Prenez garde aux Mimics, camarades !',
      },
    } as ClientMessage)
  );

  const chatWait = Date.now();
  while ((!client1ReceivedChat || !client2ReceivedChat) && Date.now() - chatWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client1ReceivedChat || !client2ReceivedChat) {
    throw new Error('Le message de chat na pas été reçu par les deux clients !');
  }
  if (client2ReceivedChat.text !== 'Prenez garde aux Mimics, camarades !') {
    throw new Error(`Texte de message invalide: ${client2ReceivedChat.text}`);
  }
  if (client2ReceivedChat.senderName !== 'Mage Arcaniste') {
    throw new Error(`Nom d'expéditeur invalide: ${client2ReceivedChat.senderName}`);
  }
  console.log('✅ Validation CHAT_MESSAGE : synchronisation bidirectionnelle réussie.');

  // 3. Client 2 s'extrait par le portail
  console.log("🏆 Client 2 s'extrait par le Portail de Cristal...");
  ws2.send(
    JSON.stringify({
      type: 'PLAYER_EXTRACTED',
      payload: {
        instanceId: instId,
        portalName: 'Portail de Cristal',
      },
    } as ClientMessage)
  );

  const extractWait = Date.now();
  while (!client1SummaryAfterExtract && Date.now() - extractWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client1SummaryAfterExtract) {
    throw new Error("Client 1 n'a pas reçu le bilan d'escouade après extraction de Client 2 !");
  }
  const extractedMember = client1SummaryAfterExtract.players.find((p) => p.name === 'Chevalier du Crépuscule');
  if (!extractedMember || extractedMember.status !== 'extracted') {
    throw new Error('Statut du membre extrait incorrect dans le bilan de convoi !');
  }
  console.log('✅ Validation BILAN EXTRACTION : statut 🏆 EXTRAIT correctement synchronisé.');

  // 4. Client 1 périt dans le donjon
  console.log('💀 Client 1 succombe aux assauts...');
  ws1.send(
    JSON.stringify({
      type: 'PLAYER_DIED',
      payload: {
        instanceId: instId,
        x: 25.5,
        y: 28.5,
        droppedItems: [
          {
            id: 'hat_puzzle_lord',
            name: 'Chapeau Énigmatique',
            slot: 'hat',
            rarity: 'epic',
            stats: { magicPower: 30 },
            flavor: 'Test mort',
          },
        ],
      },
    } as ClientMessage)
  );

  const deathWait = Date.now();
  while (!client2SummaryAfterDeath && Date.now() - deathWait < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!client2SummaryAfterDeath) {
    throw new Error("Client 2 n'a pas reçu le bilan d'escouade après la mort de Client 1 !");
  }
  const deadMember = client2SummaryAfterDeath.players.find((p) => p.name === 'Mage Arcaniste');
  if (!deadMember || deadMember.status !== 'dead') {
    throw new Error('Statut du membre décédé incorrect dans le bilan de convoi !');
  }
  console.log('✅ Validation BILAN MORT : statut 💀 MORT correctement synchronisé.');

  ws1.close();
  ws2.close();

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS MULTIJOUEUR PHASE 4 SONT VALIDÉS !');
  console.log('======================================================\n');
}

runTestPhase4().catch((err) => {
  console.error('❌ Échec du test Phase 4 :', err);
  process.exit(1);
});
