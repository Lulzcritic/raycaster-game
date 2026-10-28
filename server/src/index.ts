import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Matchmaker } from './Matchmaker';
import type { ClientMessage } from '../../src/types/network';

const PORT = Number(process.env.PORT) || 3001;
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

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

  // Distribution des fichiers statiques du client (si dist/ existe)
  if (fs.existsSync(DIST_DIR)) {
    const rawUrl = req.url?.split('?')[0] ?? '/';
    const cleanUrl = rawUrl === '/' ? '/index.html' : rawUrl;
    const safePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(DIST_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback SPA
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end('Raycaster Multiplayer Gateway (Frontend non compilé dans dist/)');
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

server.listen(PORT, '0.0.0.0', () => {
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
