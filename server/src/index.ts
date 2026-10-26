import http from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Matchmaker } from './Matchmaker';
import type { ClientMessage } from '../../src/types/network';

const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer((req, res) => {
  // En-têtes CORS pour requêtes HTTP de debug / status
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.url === '/health' || req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        timestamp: Date.now(),
        matchmaker: matchmaker.getStatus(),
      })
    );
    return;
  }

  res.writeHead(404);
  res.end('Raycaster Multiplayer Gateway');
});

const wss = new WebSocketServer({ server });
const matchmaker = new Matchmaker();

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[Server] Nouveau client connecté depuis ${ip}`);

  matchmaker.registerClient(ws);

  ws.on('message', (raw: string | Buffer) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      matchmaker.handleMessage(ws, message);
    } catch (err) {
      console.error('[Server] Message invalide reçu:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[Server] Client déconnecté: ${ip}`);
    matchmaker.unregisterClient(ws);
  });

  ws.on('error', (err) => {
    console.error(`[Server] Erreur socket client (${ip}):`, err);
    matchmaker.unregisterClient(ws);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏰 RAYCASTER MULTIPLAYER SERVER EN LIGNE`);
  console.log(`📡 Port: ${PORT} (WebSocket & HTTP Health)`);
  console.log(`⏱️ Cycle de convoi : toutes les 60 secondes`);
  console.log(`====================================================`);
});

process.on('SIGINT', () => {
  console.log('\n[Server] Arrêt du serveur...');
  matchmaker.destroy();
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
