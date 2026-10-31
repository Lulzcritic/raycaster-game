import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AnalyticsService } from '../server/src/AnalyticsService';
import { Matchmaker } from '../server/src/Matchmaker';

// Mock minimaliste WebSocket pour tester les notifications et expulsions
class MockWebSocket {
  public readyState = 1; // WebSocket.OPEN
  public OPEN = 1;
  public CLOSED = 3;
  public sentMessages: string[] = [];
  public closedWithCode: number | null = null;
  public closedWithReason: string | null = null;

  public send(data: string): void {
    this.sentMessages.push(data);
  }

  public close(code?: number, reason?: string): void {
    this.readyState = this.CLOSED;
    this.closedWithCode = code ?? 1000;
    this.closedWithReason = reason ?? '';
  }
}

async function runTests() {
  console.log('🧪 Démarrage des tests du Système Admin & Télémétrie de Jeu (Citadel Analytics)...\n');

  // =========================================================================
  // 1. Authentification Admin
  // =========================================================================
  console.log('1. Test de l authentification administrateur (Token & Mot de passe)...');
  const analytics = AnalyticsService.getInstance();

  // Test mot de passe erroné
  const failLogin = analytics.loginAdmin('mot_de_passe_incorrect');
  assert.strictEqual(failLogin.success, false, 'Le mot de passe incorrect doit échouer');
  assert.strictEqual(failLogin.token, undefined);

  // Test mot de passe correct (défaut 'citadel_admin')
  const validPass = process.env.ADMIN_PASSWORD || 'citadel_admin';
  const successLogin = analytics.loginAdmin(validPass);
  assert.strictEqual(successLogin.success, true, 'La connexion admin doit réussir');
  assert.ok(successLogin.token, 'Un jeton admin doit être généré');
  assert.ok(successLogin.expiresAt! > Date.now(), 'La date d expiration doit être dans le futur');

  const token = successLogin.token!;

  // Vérification du token valide
  assert.strictEqual(analytics.verifyAdminToken(token), true, 'Le jeton valide doit être accepté');
  assert.strictEqual(analytics.verifyAdminToken('fake-token-xyz'), false, 'Un faux jeton doit être rejeté');

  // Déconnexion
  analytics.logoutAdmin(token);
  assert.strictEqual(analytics.verifyAdminToken(token), false, 'Après déconnexion, le jeton doit être révoqué');
  console.log('   ✅ Authentification admin validée.\n');

  // =========================================================================
  // 2. Ingestion des événements télémétriques & Mémoire Ring-Buffer
  // =========================================================================
  console.log('2. Test d enregistrement des événements et mémoire tampon...');
  analytics.clearMemoryEvents();

  // Ingestion de plusieurs événements variés
  analytics.trackEvent({
    eventType: 'session_start',
    playerId: 'p-1',
    playerName: 'Valerius',
    data: { ip: '192.168.1.10' },
  });

  analytics.trackEvent({
    eventType: 'queue_join',
    playerId: 'p-1',
    playerName: 'Valerius',
  });

  analytics.trackEvent({
    eventType: 'raid_start',
    playerId: 'p-1',
    playerName: 'Valerius',
    instanceId: 'inst-100',
  });

  analytics.trackEvent({
    eventType: 'chest_open',
    playerId: 'p-1',
    playerName: 'Valerius',
    instanceId: 'inst-100',
    data: { isMimic: false, itemsCount: 3 },
  });

  analytics.trackEvent({
    eventType: 'chest_open',
    playerId: 'p-1',
    playerName: 'Valerius',
    instanceId: 'inst-100',
    data: { isMimic: true, itemsCount: 0 },
  });

  analytics.trackEvent({
    eventType: 'boss_kill',
    playerId: 'p-1',
    playerName: 'Valerius',
    instanceId: 'inst-100',
    data: { bossName: 'Titan of Decay' },
  });

  analytics.trackEvent({
    eventType: 'raid_extract',
    playerId: 'p-1',
    playerName: 'Valerius',
    instanceId: 'inst-100',
    data: { portalName: 'East Portal', coins: 150, durationSeconds: 120 },
  });

  analytics.trackEvent({
    eventType: 'session_start',
    playerId: 'p-2',
    playerName: 'Morgana',
  });

  analytics.trackEvent({
    eventType: 'raid_death',
    playerId: 'p-2',
    playerName: 'Morgana',
    instanceId: 'inst-101',
    data: { durationSeconds: 45, droppedItemsCount: 2 },
  });

  const allEvents = await analytics.getEvents();
  assert.strictEqual(allEvents.length, 9, '9 événements doivent être présents dans la mémoire tampon');

  // Filtrage par type
  const chestEvents = await analytics.getEvents({ eventType: 'chest_open' });
  assert.strictEqual(chestEvents.length, 2, 'Doit trouver 2 ouvertures de coffre');

  // Recherche textuelle
  const searchResults = await analytics.getEvents({ search: 'Morgana' });
  assert.strictEqual(searchResults.length, 2, 'Doit trouver 2 événements pour Morgana');
  console.log('   ✅ Ingestion et filtres des événements validés.\n');

  // =========================================================================
  // 3. Agrégations & Calcul du Funnel de Conversion Gameplay
  // =========================================================================
  console.log('3. Test des métriques analytics & calcul du funnel de conversion...');
  const summary = await analytics.getAnalyticsSummary('24h');

  assert.strictEqual(summary.funnel.sessions, 2, '2 sessions démarrées');
  assert.strictEqual(summary.funnel.queueJoins, 1, '1 entrée en file');
  assert.strictEqual(summary.funnel.raidsStarted, 1, '1 raid démarré');
  assert.strictEqual(summary.funnel.extractions, 1, '1 extraction réussie');
  assert.strictEqual(summary.funnel.deaths, 1, '1 mort');

  // Taux de survie: 1 extract / (1 extract + 1 mort) = 50%
  assert.strictEqual(summary.survivalRate, 50, 'Le taux de survie doit être de 50%');

  // Or et boss
  assert.strictEqual(summary.goldExtracted, 150, '150 pièces d or extraites au total');
  assert.strictEqual(summary.chestsOpened, 2, '2 coffres ouverts');
  assert.strictEqual(summary.mimicsFound, 1, '1 mimic identifié');
  assert.strictEqual(summary.bossesDefeated, 1, '1 boss vaincu');
  assert.strictEqual(summary.hourlyActivity.length, 24, '24 créneaux horaires d activité');
  console.log('   ✅ Calculs statistiques et funnel validés.\n');

  // =========================================================================
  // 4. Intégration Matchmaker (Clients, IP, Télémétrie & Outils Admin)
  // =========================================================================
  console.log('4. Test des contrôles de gestion des joueurs et diffusion live...');
  const matchmaker = new Matchmaker();
  const mockWs1 = new MockWebSocket() as any;
  const mockWs2 = new MockWebSocket() as any;

  matchmaker.registerClient(mockWs1, '10.0.0.1');
  matchmaker.registerClient(mockWs2, '10.0.0.2');

  // Mise à jour des identités
  matchmaker.handleMessage(mockWs1, {
    type: 'JOIN_QUEUE',
    payload: { playerName: 'PlayerAlpha', skinId: 'skin_warrior', gearScore: 350 },
  });
  matchmaker.handleMessage(mockWs2, {
    type: 'JOIN_QUEUE',
    payload: { playerName: 'PlayerBeta', skinId: 'skin_mage', gearScore: 580 },
  });

  const clients = matchmaker.getAllClientsWithDetails();
  assert.strictEqual(clients.length, 2, 'Deux clients doivent être répertoriés avec métadonnées');
  assert.strictEqual(clients[0].name, 'PlayerAlpha');
  assert.strictEqual(clients[0].ip, '10.0.0.1');
  assert.strictEqual(clients[0].gearScore, 350);
  assert.strictEqual(clients[1].gearScore, 580);

  // Test de vue d'ensemble temps réel
  const realtime = await analytics.getRealtimeOverview(matchmaker);
  assert.strictEqual(realtime.matchmaker.connectedClients, 2);
  assert.strictEqual(realtime.matchmaker.queuedPlayers, 2);
  assert.strictEqual(realtime.players.length, 2);
  assert.ok(realtime.server.uptimeSeconds >= 0);
  assert.ok(realtime.server.memoryRssMb > 0);

  // Test Broadcast Administrateur
  matchmaker.broadcastAnnouncement('Serveur: Maintenance dans 10 minutes !');
  assert.ok(mockWs1.sentMessages.length >= 1);
  assert.ok(mockWs2.sentMessages.length >= 1);
  const lastMsg1 = JSON.parse(mockWs1.sentMessages[mockWs1.sentMessages.length - 1]);
  assert.strictEqual(lastMsg1.type, 'REMOTE_CHAT_MESSAGE');
  assert.strictEqual(lastMsg1.payload.senderName, '📢 [ADMIN]');
  assert.strictEqual(lastMsg1.payload.isSystem, true);
  assert.ok(lastMsg1.payload.text.includes('Maintenance dans 10 minutes'));

  // Test Expulsion (Kick) d'un joueur
  const client1Id = clients[0].id;
  const kicked = matchmaker.kickClient(client1Id, 'Comportement suspect');
  assert.strictEqual(kicked, true, 'L expulsion du joueur 1 doit réussir');
  assert.strictEqual(mockWs1.closedWithCode, 4001, 'Le socket doit être fermé avec le code 4001');
  assert.strictEqual(mockWs1.closedWithReason, 'Comportement suspect');

  matchmaker.destroy();
  console.log('   ✅ Contrôles d administration temps réel (Overview, Broadcast, Kick) validés.\n');

  // =========================================================================
  // 5. Intégrité du Fichier Console Admin HTML
  // =========================================================================
  console.log('5. Vérification de l existence et conformité de l interface web /admin...');
  const adminHtmlPath = path.resolve(process.cwd(), 'server', 'src', 'admin', 'admin.html');
  assert.ok(fs.existsSync(adminHtmlPath), 'Le fichier server/src/admin/admin.html doit exister');

  const htmlContent = fs.readFileSync(adminHtmlPath, 'utf-8');
  assert.ok(htmlContent.includes('CITADEL'), 'Doit afficher la marque Citadel');
  assert.ok(htmlContent.includes('tab-realtime'), 'Doit comporter l onglet Temps Réel');
  assert.ok(htmlContent.includes('tab-analytics'), 'Doit comporter l onglet Analytics');
  assert.ok(htmlContent.includes('tab-logs'), 'Doit comporter l onglet Logs');
  assert.ok(htmlContent.includes('tab-moderation'), 'Doit comporter l onglet Modération');
  assert.ok(htmlContent.includes('login-modal'), 'Doit comporter la modale de mot de passe');
  console.log('   ✅ Fichier HTML de la console admin validé.\n');

  console.log('=========================================================================');
  console.log('🎉 TOUS LES TESTS ADMIN & ANALYTICS ONT RÉUSSI AVEC SUCCÈS !');
  console.log('=========================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Échec du test admin et analytics:', err);
  process.exit(1);
});
