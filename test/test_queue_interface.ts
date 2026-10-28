import WebSocket from 'ws';
import type {
  ClientMessage,
  MatchStartPayload,
  QueueStatusPayload,
  ServerMessage,
} from '../src/types/network';

async function runQueueInterfaceTest() {
  console.log("🧪 Début du test de l'interface de file d'attente (Matchmaking & Session Solitaire)...");

  const ws1 = new WebSocket('ws://localhost:3001');
  const ws2 = new WebSocket('ws://localhost:3001');

  await Promise.all([
    new Promise<void>((res) => ws1.on('open', () => res())),
    new Promise<void>((res) => ws2.on('open', () => res())),
  ]);

  console.log('✅ Deux WebSockets connectées au serveur.');

  let ws1Status: QueueStatusPayload | null = null;
  let ws1MatchStart: MatchStartPayload | null = null;

  ws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'QUEUE_STATUS') {
      ws1Status = msg.payload;
    } else if (msg.type === 'MATCH_START') {
      ws1MatchStart = msg.payload;
      console.log('🎉 MATCH_START reçu pour le joueur dans la session:', msg.payload.instanceId);
    }
  });

  // 1. Joueur 1 rejoint la file
  console.log('📝 Joueur 1 rejoint la file...');
  ws1.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Énigmatique', gearScore: 120, skinId: 'puzzle_lord' },
    } as ClientMessage)
  );

  await new Promise((r) => setTimeout(r, 1200));

  if (!ws1Status || ws1Status.queuedCount < 1) {
    throw new Error('Joueur 1 non trouvé dans la file d attente !');
  }
  console.log('✅ Joueur 1 bien présent dans la file. Countdown restant:', ws1Status.cycleCountdownSec, 's');

  // 2. Joueur 2 rejoint la file
  console.log('📝 Joueur 2 rejoint la file...');
  ws2.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Gourmand', gearScore: 90, skinId: 'gouter_lord' },
    } as ClientMessage)
  );

  await new Promise((r) => setTimeout(r, 1200));
  if (!ws1Status || ws1Status.queuedCount < 2) {
    throw new Error('Les deux joueurs ne sont pas présents dans la file !');
  }
  console.log('✅ Les 2 joueurs sont visibles dans la liste:', ws1Status.queuedPlayers.map((p) => p.name));

  // 3. Joueur 2 quitte la file
  console.log('🚪 Joueur 2 quitte la file...');
  ws2.send(JSON.stringify({ type: 'LEAVE_QUEUE' } as ClientMessage));

  await new Promise((r) => setTimeout(r, 1200));
  if (!ws1Status || ws1Status.queuedCount !== 1) {
    throw new Error('Joueur 2 n a pas été retiré proprement de la file !');
  }
  console.log('✅ Joueur 2 a quitté la file avec succès. Joueur 1 reste seul:', ws1Status.queuedPlayers[0].name);

  // 4. Attente du départ du convoi (la partie doit démarrer même si le joueur est seul !)
  console.log('⏳ Attente de l échéance du convoi pour valider le lancement en session solitaire...');
  const waitStart = Date.now();
  while (!ws1MatchStart && Date.now() - waitStart < 70000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!ws1MatchStart) {
    throw new Error('La session ne s est pas lancée pour le joueur seul !');
  }

  console.log('✅ Confirmation : la session démarre en multijoueur même avec 1 seul joueur inscrit !');
  console.log('Instance ID:', ws1MatchStart.instanceId, '| Seed:', ws1MatchStart.mapSeed);

  ws1.close();
  ws2.close();

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS DE L INTERFACE DE FILE SONT VALIDÉS !');
  console.log('======================================================\n');
}

runQueueInterfaceTest().catch((err) => {
  console.error('❌ Échec du test :', err);
  process.exit(1);
});
