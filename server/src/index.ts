import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer, type WebSocket } from 'ws';
import { Matchmaker } from './Matchmaker';
import { Database } from './db/Database';
import { AuthService } from './db/AuthService';
import { PlayerRepository } from './db/PlayerRepository';
import { AnalyticsService } from './AnalyticsService';
import type { ClientMessage } from '../../src/types/network';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2e6) {
        req.destroy();
        reject(new Error('Payload trop volumineux (>2MB)'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch (err) {
        reject(new Error('Format JSON invalide'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function extractToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const urlObj = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
  return urlObj.searchParams.get('token');
}

let cachedAdminHtml: string | null = null;
function getAdminHtml(): string | null {
  if (cachedAdminHtml) return cachedAdminHtml;
  const candidates = [
    path.join(__dirname, 'admin', 'admin.html'),
    path.join(__dirname, '..', 'src', 'admin', 'admin.html'),
    path.join(process.cwd(), 'server', 'src', 'admin', 'admin.html'),
    path.join(process.cwd(), 'dist-server', 'src', 'admin', 'admin.html'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        cachedAdminHtml = fs.readFileSync(c, 'utf-8');
        return cachedAdminHtml;
      }
    } catch {}
  }
  return null;
}

function requireAdminAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const token = extractToken(req);
  if (!token || !AnalyticsService.getInstance().verifyAdminToken(token)) {
    sendJson(res, 401, { success: false, error: 'Accès administrateur non autorisé ou session expirée' });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    // En-têtes CORS universels pour les requêtes HTTP et requêtes preflight OPTIONS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    const rawUrl = req.url ?? '/';
    let pathName = rawUrl.split('?')[0];

    // Normalisation du chemin : si le reverse proxy (Nginx/Caddy) transmet le préfixe /toc, on le retire
    if (pathName.startsWith('/toc/')) {
      pathName = pathName.substring(4); // ex: "/toc/api/auth/register" -> "/api/auth/register"
    } else if (pathName === '/toc') {
      pathName = '/';
    }

  // 1. Healthcheck système & base de données
  if (pathName === '/health' || pathName === '/status') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: Date.now(),
      database: {
        connected: Database.isConnected(),
      },
      matchmaker: matchmaker.getStatus(),
    });
    return;
  }

  // 1b. Interface Console Administrateur & Télémétrie (/admin ou /admin/ ou /citadel-admin)
  if (
    (pathName === '/admin' || pathName === '/admin/' || pathName === '/citadel-admin' || pathName === '/citadel-admin/') &&
    (req.method === 'GET' || req.method === 'HEAD')
  ) {
    const html = getAdminHtml();
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
  }

  // 2. Healthcheck dédié PostgreSQL
  if (pathName === '/api/db/health' || pathName === '/api/db/status') {
    sendJson(res, 200, {
      connected: Database.isConnected(),
      message: Database.isConnected()
        ? 'Base de données PostgreSQL connectée et opérationnelle'
        : 'PostgreSQL hors-ligne (démarrez avec docker compose up -d postgres)',
    });
    return;
  }

  // 3. API Authentification : Inscription (/api/auth/register)
  if (pathName === '/api/auth/register' && req.method === 'POST') {
    if (!Database.isConnected()) {
      sendJson(res, 503, {
        success: false,
        error: 'Base de données PostgreSQL hors ligne. Veuillez démarrer le conteneur Docker.',
      });
      return;
    }
    try {
      const body = await parseJsonBody<{ username?: string; password?: string }>(req);
      const result = await AuthService.register(body.username ?? '', body.password ?? '');
      AnalyticsService.getInstance().trackEvent({
        eventType: 'account_register',
        playerId: result.user?.id,
        playerName: result.user?.username,
        data: { username: body.username },
      });
      sendJson(res, 201, { success: true, ...result });
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message });
    }
    return;
  }

  // 4. API Authentification : Connexion (/api/auth/login)
  if (pathName === '/api/auth/login' && req.method === 'POST') {
    if (!Database.isConnected()) {
      sendJson(res, 503, {
        success: false,
        error: 'Base de données PostgreSQL hors ligne. Veuillez démarrer le conteneur Docker.',
      });
      return;
    }
    try {
      const body = await parseJsonBody<{ username?: string; password?: string }>(req);
      const result = await AuthService.login(body.username ?? '', body.password ?? '');
      AnalyticsService.getInstance().trackEvent({
        eventType: 'account_login',
        playerId: result.user?.id,
        playerName: result.user?.username,
        data: { username: body.username },
      });
      sendJson(res, 200, { success: true, ...result });
    } catch (err: any) {
      sendJson(res, 401, { success: false, error: err.message });
    }
    return;
  }

  // 5. API Authentification : Déconnexion (/api/auth/logout)
  if (pathName === '/api/auth/logout' && req.method === 'POST') {
    const token = extractToken(req);
    if (token) {
      await AuthService.logout(token);
    }
    sendJson(res, 200, { success: true });
    return;
  }

  // 6. API Profil & Inventaire : Récupération des données du joueur (/api/auth/me ou /api/player/data)
  if ((pathName === '/api/auth/me' || pathName === '/api/player/data') && req.method === 'GET') {
    if (!Database.isConnected()) {
      sendJson(res, 503, { success: false, error: 'Base de données PostgreSQL hors ligne' });
      return;
    }
    const token = extractToken(req);
    if (!token) {
      sendJson(res, 401, { success: false, error: 'Jeton d authentification manquant (Bearer token)' });
      return;
    }
    const user = await AuthService.verifySession(token);
    if (!user) {
      sendJson(res, 401, { success: false, error: 'Session expirée ou invalide' });
      return;
    }
    const data = await PlayerRepository.getFullPlayerData(user.id);
    sendJson(res, 200, { success: true, user, ...data });
    return;
  }

  // 7. API Joueur : Synchronisation et sauvegarde d'inventaire, monnaie et quêtes (/api/player/sync)
  if ((pathName === '/api/player/sync' || pathName === '/api/player/save') && req.method === 'POST') {
    if (!Database.isConnected()) {
      sendJson(res, 503, { success: false, error: 'Base de données PostgreSQL hors ligne' });
      return;
    }
    const token = extractToken(req);
    if (!token) {
      sendJson(res, 401, { success: false, error: 'Jeton d authentification manquant (Bearer token)' });
      return;
    }
    const user = await AuthService.verifySession(token);
    if (!user) {
      sendJson(res, 401, { success: false, error: 'Session expirée ou invalide' });
      return;
    }
    try {
      const body = await parseJsonBody(req);
      const result = await PlayerRepository.savePlayerData(user.id, body);
      sendJson(res, 200, { success: true, user, ...result });
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message });
    }
    return;
  }

  // 8. Classement officiel des joueurs (Ladder selon le Gear Score max)
  if (req.method === 'GET' && pathName === '/api/ladder') {
    if (!Database.isConnected()) {
      sendJson(res, 200, {
        success: true,
        offline: true,
        ladder: [],
        message: 'PostgreSQL est actuellement hors-ligne (mode mémoire)',
      });
      return;
    }
    try {
      const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
      const limitParam = Number(parsedUrl.searchParams.get('limit')) || 50;
      const ladder = await PlayerRepository.getLadder(limitParam);
      sendJson(res, 200, { success: true, ladder });
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 8b. API Admin : Authentification (/api/admin/login)
  if (pathName === '/api/admin/login' && req.method === 'POST') {
    const body = await parseJsonBody<{ password?: string }>(req);
    const authResult = AnalyticsService.getInstance().loginAdmin(body.password || '');
    if (authResult.success) {
      sendJson(res, 200, authResult);
    } else {
      sendJson(res, 401, authResult);
    }
    return;
  }

  // 8c. API Admin : Déconnexion (/api/admin/logout)
  if (pathName === '/api/admin/logout' && req.method === 'POST') {
    const token = extractToken(req);
    if (token) {
      AnalyticsService.getInstance().logoutAdmin(token);
    }
    sendJson(res, 200, { success: true });
    return;
  }

  // 8d. API Admin : Vue d'ensemble temps réel (/api/admin/realtime)
  if (pathName === '/api/admin/realtime' && req.method === 'GET') {
    if (!requireAdminAuth(req, res)) return;
    const overview = await AnalyticsService.getInstance().getRealtimeOverview(matchmaker);
    sendJson(res, 200, { success: true, ...overview });
    return;
  }

  // 8e. API Admin : Télémétrie et Funnel agrégé (/api/admin/analytics)
  if (pathName === '/api/admin/analytics' && req.method === 'GET') {
    if (!requireAdminAuth(req, res)) return;
    const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
    const timeframe = (parsedUrl.searchParams.get('timeframe') as any) || '24h';
    const stats = await AnalyticsService.getInstance().getAnalyticsSummary(timeframe);
    sendJson(res, 200, { success: true, stats });
    return;
  }

  // 8f. API Admin : Liste des événements / logs (/api/admin/events)
  if (pathName === '/api/admin/events' && req.method === 'GET') {
    if (!requireAdminAuth(req, res)) return;
    const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
    const eventType = parsedUrl.searchParams.get('type') || undefined;
    const limit = Math.min(Number(parsedUrl.searchParams.get('limit')) || 100, 500);
    const offset = Number(parsedUrl.searchParams.get('offset')) || 0;
    const playerId = parsedUrl.searchParams.get('playerId') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;

    const events = await AnalyticsService.getInstance().getEvents({
      eventType,
      limit,
      offset,
      playerId,
      search,
    });
    sendJson(res, 200, { success: true, events, count: events.length });
    return;
  }

  // 8g. API Admin : Diffusion globale d'une annonce (/api/admin/broadcast)
  if (pathName === '/api/admin/broadcast' && req.method === 'POST') {
    if (!requireAdminAuth(req, res)) return;
    const body = await parseJsonBody<{ message?: string }>(req);
    const msg = (body.message || '').trim();
    if (!msg) {
      sendJson(res, 400, { success: false, error: 'Le message ne peut pas être vide' });
      return;
    }
    matchmaker.broadcastAnnouncement(msg);
    sendJson(res, 200, { success: true, message: 'Message broadcasté à tous les joueurs en ligne' });
    return;
  }

  // 8h. API Admin : Expulsion d'un joueur en ligne (/api/admin/kick)
  if (pathName === '/api/admin/kick' && req.method === 'POST') {
    if (!requireAdminAuth(req, res)) return;
    const body = await parseJsonBody<{ clientId?: string; reason?: string }>(req);
    if (!body.clientId) {
      sendJson(res, 400, { success: false, error: 'Identifiant clientId requis' });
      return;
    }
    const kicked = matchmaker.kickClient(body.clientId, body.reason);
    sendJson(res, 200, {
      success: kicked,
      message: kicked ? 'Joueur expulsé avec succès' : 'Client introuvable ou déjà déconnecté',
    });
    return;
  }

  // 9. Distribution des fichiers statiques du client (si dist/ existe)
  if (fs.existsSync(DIST_DIR)) {
    const cleanUrl = pathName === '/' ? '/index.html' : pathName;
    const safePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(DIST_DIR, safePath);

    // Vérification du fichier demandé (directement, ou en tolérant le préfixe /toc/)
    let targetFilePath = filePath;
    if (!fs.existsSync(targetFilePath) || !fs.statSync(targetFilePath).isFile()) {
      const withoutToc = safePath.replace(/^[/\\]?toc[/\\]?/i, '');
      const altPath = path.join(DIST_DIR, withoutToc);
      if (fs.existsSync(altPath) && fs.statSync(altPath).isFile()) {
        targetFilePath = altPath;
      }
    }

    if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).isFile()) {
      const ext = path.extname(targetFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(targetFilePath).pipe(res);
      return;
    }

    // Fallback SPA : UNIQUEMENT pour les requêtes GET / HEAD
    // Une requête POST/PUT/DELETE sur une route non trouvée ne doit jamais renvoyer le HTML
    if (req.method === 'GET' || req.method === 'HEAD') {
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
    }
  }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Route non trouvée sur la passerelle (${req.method} ${rawUrl})` }));
  } catch (err: any) {
    console.error('[Server] Erreur HTTP non gérée:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { success: false, error: 'Erreur interne du serveur' });
    }
  }
});

const wss = new WebSocketServer({ server });
const matchmaker = new Matchmaker();

wss.on('connection', (ws: WebSocket, req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown';
  console.log(`[Server] Nouveau client connecté depuis ${ip}`);

  matchmaker.registerClient(ws, ip);

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
  console.log(`📡 Port: ${PORT} (WebSocket, REST API & HTTP Health)`);
  console.log(`⏱️ Cycle de convoi : toutes les 60 secondes`);
  console.log(`====================================================`);

  // Initialisation non-bloquante du pool PostgreSQL
  Database.init().catch((err) => {
    console.warn('[Database] Initialisation échouée:', err.message);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] Arrêt du serveur...');
  matchmaker.destroy();
  Database.close().catch(() => {});
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
