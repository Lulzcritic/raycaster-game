import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import WebSocket from 'ws';
import type { ClientMessage, QueueStatusPayload, ServerMessage } from '../src/types/network';

const SERVER_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

async function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runCITests() {
  console.log('🧪 Démarrage de la suite de tests CI automatisée...');

  let serverProcess: ChildProcess | null = null;
  const isAlreadyRunning = await checkHealth();

  if (!isAlreadyRunning) {
    console.log('🚀 Lancement du serveur multijoueur pour les tests...');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    serverProcess = spawn(npxCmd, ['tsx', 'server/src/index.ts'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });

    const startWait = Date.now();
    let ready = false;
    while (!ready && Date.now() - startWait < 15000) {
      await new Promise((r) => setTimeout(r, 500));
      ready = await checkHealth();
    }

    if (!ready) {
      throw new Error('Le serveur n a pas répondu sur /health dans les 15 secondes.');
    }
  }

  console.log('✅ Endpoint HTTP /health opérationnel.');

  // 1. Connexion de 2 WebSockets
  const ws1 = new WebSocket(WS_URL);
  const ws2 = new WebSocket(WS_URL);

  await Promise.all([
    new Promise<void>((res) => ws1.on('open', () => res())),
    new Promise<void>((res) => ws2.on('open', () => res())),
  ]);
  console.log('✅ Connexion WebSocket établie pour 2 clients simultanés.');

  let ws1Status: QueueStatusPayload | null = null;
  let ws1ReceivedPong = false;

  ws1.on('message', (raw) => {
    const msg = JSON.parse(raw.toString()) as ServerMessage;
    if (msg.type === 'QUEUE_STATUS') {
      ws1Status = msg.payload;
    } else if (msg.type === 'PONG') {
      ws1ReceivedPong = true;
    }
  });

  // 2. Test Ping/Pong
  ws1.send(JSON.stringify({ type: 'PING', payload: { timestamp: Date.now() } } as ClientMessage));
  const pingWait = Date.now();
  while (!ws1ReceivedPong && Date.now() - pingWait < 3000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ws1ReceivedPong) {
    throw new Error('Échec du test Ping/Pong WebSocket.');
  }
  console.log('✅ Test Ping/Pong validé.');

  // 3. Inscription Joueur 1 dans la file
  ws1.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Énigmatique', gearScore: 120, skinId: 'puzzle_lord' },
    } as ClientMessage)
  );

  const q1Wait = Date.now();
  while ((!ws1Status || ws1Status.queuedCount < 1) && Date.now() - q1Wait < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ws1Status || ws1Status.queuedCount !== 1) {
    throw new Error('Échec de l inscription de Joueur 1 dans la file.');
  }
  console.log('✅ Inscription Joueur 1 validée (file: 1).');

  // 4. Inscription Joueur 2 dans la file
  ws2.send(
    JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: { playerName: 'Lord Gourmand', gearScore: 95, skinId: 'gouter_lord' },
    } as ClientMessage)
  );

  const q2Wait = Date.now();
  while ((!ws1Status || ws1Status.queuedCount < 2) && Date.now() - q2Wait < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ws1Status || ws1Status.queuedCount !== 2) {
    throw new Error('Échec de la synchronisation de 2 joueurs dans la file.');
  }
  console.log('✅ Inscription Joueur 2 et diffusion de liste validées (file: 2).');

  // 5. Désinscription Joueur 2
  ws2.send(JSON.stringify({ type: 'LEAVE_QUEUE' } as ClientMessage));

  const leaveWait = Date.now();
  while ((!ws1Status || ws1Status.queuedCount !== 1) && Date.now() - leaveWait < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ws1Status || ws1Status.queuedCount !== 1) {
    throw new Error('Échec de la désinscription de Joueur 2 de la file.');
  }
  console.log('✅ Désinscription Joueur 2 validée (file: 1).');

  ws1.close();
  ws2.close();

  if (serverProcess && serverProcess.pid) {
    console.log('🛑 Arrêt du serveur de test temporaire...');
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
      } else {
        process.kill(-serverProcess.pid, 'SIGKILL');
      }
    } catch {
      serverProcess.kill('SIGKILL');
    }
  }

  console.log('\n======================================================');
  console.log('🎉 TOUS LES TESTS CI SONT VALIDÉS AVEC SUCCÈS !');
  console.log('======================================================\n');
  process.exit(0);
}

runCITests().catch((err) => {
  console.error('❌ Échec des tests CI :', err);
  process.exit(1);
});
