import crypto from 'node:crypto';
import { Database } from './db/Database';
import type { Matchmaker } from './Matchmaker';

export interface GameEvent {
  id: string | number;
  eventType: string;
  playerName: string;
  isGuest: boolean;
  userId?: string | null;
  gearScore: number;
  instanceId?: string | null;
  data: Record<string, any>;
  createdAt: Date;
}

export interface AdminTokenSession {
  token: string;
  createdAt: number;
  expiresAt: number;
}

export class AnalyticsService {
  private static instance: AnalyticsService | null = null;
  private readonly memoryEvents: GameEvent[] = [];
  private readonly MAX_MEMORY_EVENTS = 1000;
  private readonly adminSessions = new Map<string, AdminTokenSession>();
  private readonly serverStartTime = Date.now();
  private peakCCU = 0;

  private constructor() {
    // Nettoyage régulier des sessions admin expirées (toutes les heures, unref pour ne pas bloquer le runtime)
    const cleanTimer = setInterval(() => this.cleanExpiredSessions(), 3600000);
    cleanTimer.unref();
  }

  public static getInstance(): AnalyticsService {
    if (!this.instance) {
      this.instance = new AnalyticsService();
    }
    return this.instance;
  }

  // =========================================================================
  // GESTION DE LA SÉCURITÉ & AUTHENTIFICATION ADMIN
  // =========================================================================

  private getAdminPassword(): string {
    return process.env.ADMIN_PASSWORD || 'citadel_admin';
  }

  public loginAdmin(password: string): { success: boolean; token?: string; expiresAt?: number; error?: string } {
    const expected = this.getAdminPassword();
    if (!password || password !== expected) {
      return { success: false, error: 'Mot de passe administrateur incorrect' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24h

    this.adminSessions.set(token, { token, createdAt: now, expiresAt });
    return { success: true, token, expiresAt };
  }

  public verifyAdminToken(token: string | null | undefined): boolean {
    if (!token) return false;
    const session = this.adminSessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.adminSessions.delete(token);
      return false;
    }
    return true;
  }

  public logoutAdmin(token: string): void {
    this.adminSessions.delete(token);
  }

  public clearMemoryEvents(): void {
    this.memoryEvents = [];
  }

  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.adminSessions.entries()) {
      if (now > session.expiresAt) {
        this.adminSessions.delete(token);
      }
    }
  }

  // =========================================================================
  // ENREGISTREMENT DES ÉVÉNEMENTS DE JEU (TÉLÉMÉTRIE)
  // =========================================================================

  public async trackEvent(event: {
    eventType: string;
    playerName?: string;
    isGuest?: boolean;
    userId?: string | null;
    gearScore?: number;
    instanceId?: string | null;
    data?: Record<string, any>;
    createdAt?: Date;
  }): Promise<GameEvent> {
    const newEvent: GameEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: event.eventType,
      playerName: event.playerName || 'Inconnu',
      isGuest: event.isGuest ?? true,
      userId: event.userId ?? null,
      gearScore: event.gearScore ?? 0,
      instanceId: event.instanceId ?? null,
      data: event.data ?? {},
      createdAt: event.createdAt ?? new Date(),
    };

    // 1. Stockage en mémoire vive (Ring Buffer rapide)
    this.memoryEvents.unshift(newEvent);
    if (this.memoryEvents.length > this.MAX_MEMORY_EVENTS) {
      this.memoryEvents.pop();
    }

    // 2. Persistance asynchrone dans PostgreSQL si connecté
    if (Database.isConnected()) {
      try {
        const query = `
          INSERT INTO game_events (event_type, player_name, is_guest, user_id, gear_score, instance_id, data, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id;
        `;
        const params = [
          newEvent.eventType,
          newEvent.playerName,
          newEvent.isGuest,
          newEvent.userId,
          newEvent.gearScore,
          newEvent.instanceId,
          JSON.stringify(newEvent.data),
          newEvent.createdAt,
        ];
        const res = await Database.query(query, params);
        if (res.rows[0]?.id) {
          newEvent.id = res.rows[0].id;
        }
      } catch (err: any) {
        // En cas d'erreur DB, on ne bloque pas le jeu
        console.warn('[Analytics] Échec de la persistance DB de l\'événement:', err.message);
      }
    }

    return newEvent;
  }

  // =========================================================================
  // TABLEAU DE BORD TEMPS RÉEL (REAL-TIME SNAPSHOT)
  // =========================================================================

  public getRealtimeOverview(matchmaker: Matchmaker): {
    server: {
      uptimeSec: number;
      uptimeSeconds: number;
      uptimeFormatted: string;
      memoryRssMb: number;
      memoryHeapMb: number;
      peakCCU: number;
      databaseOnline: boolean;
      databaseConnected: boolean;
      activeSockets: number;
      nodeVersion: string;
      timestamp: number;
    };
    matchmaker: {
      connectedClients: number;
      lobbyPlayers: number;
      queuedPlayers: number;
      raidingPlayers: number;
      queuedCount: number;
      cycleCountdownSec: number;
      convoiCountdownSeconds: number;
      activeInstances: number;
      activeInstancesCount: number;
    };
    players: Array<{
      id: string;
      name: string;
      isGuest: boolean;
      status: string;
      location: string;
      hp: number;
      maxHp: number;
      gearScore: number;
      ip: string;
      skinId?: string;
      connectedAt: number;
      connectedDurationSec: number;
      sessionDurationSeconds: number;
      instanceId?: string;
    }>;
    instances: Array<{
      id: string;
      mapSeed: number;
      uptimeSec: number;
      durationSeconds: number;
      totalPlayers: number;
      alivePlayers: number;
      deadPlayers: number;
      extractedPlayers: number;
      players: Array<{
        name: string;
        hp: number;
        maxHp: number;
        gearScore: number;
        status: string;
      }>;
    }>;
    recentEvents: GameEvent[];
    storedEventsCount: number;
  } {
    const rawClients = matchmaker.getAllClientsWithDetails();
    const currentCCU = rawClients.length;
    if (currentCCU > this.peakCCU) {
      this.peakCCU = currentCCU;
    }

    const uptimeSec = Math.floor((Date.now() - this.serverStartTime) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    const mem = process.memoryUsage();
    const memoryRssMb = Math.round(mem.rss / 1024 / 1024);
    const memoryHeapMb = Math.round(mem.heapUsed / 1024 / 1024);

    const instances = matchmaker.getActiveInstancesList();

    const formattedPlayers = rawClients.map((c) => ({
      ...c,
      sessionDurationSeconds: c.connectedDurationSec,
    }));

    const formattedInstances = instances.map((inst) => ({
      ...inst,
      durationSeconds: inst.uptimeSec,
    }));

    const lobbyPlayers = rawClients.filter((c) => c.status === 'in_lobby').length;
    const queuedPlayers = rawClients.filter((c) => c.status === 'in_queue').length;
    const raidingPlayers = rawClients.filter((c) => c.status === 'in_raid').length;

    return {
      server: {
        uptimeSec,
        uptimeSeconds: uptimeSec,
        uptimeFormatted,
        memoryRssMb,
        memoryHeapMb,
        peakCCU: this.peakCCU,
        databaseOnline: Database.isConnected(),
        databaseConnected: Database.isConnected(),
        activeSockets: currentCCU,
        nodeVersion: process.version,
        timestamp: Date.now(),
      },
      matchmaker: {
        connectedClients: currentCCU,
        lobbyPlayers,
        queuedPlayers,
        raidingPlayers,
        queuedCount: matchmaker.getQueue().length,
        cycleCountdownSec: matchmaker.getCycleCountdown(),
        convoiCountdownSeconds: matchmaker.getCycleCountdown(),
        activeInstances: instances.length,
        activeInstancesCount: instances.length,
      },
      players: formattedPlayers,
      instances: formattedInstances,
      recentEvents: this.memoryEvents.slice(0, 50),
      storedEventsCount: this.memoryEvents.length,
    };
  }

  // =========================================================================
  // ANALYTIQUE DE COMPORTEMENT & ENTONNOIR (FUNNEL & STATS)
  // =========================================================================

  public async getAnalyticsSummary(timeframe: '1h' | '24h' | '7d' | '30d' | 'all' = '24h'): Promise<{
    funnel: {
      sessions: number;
      sessionsCount: number;
      queueJoins: number;
      raidsStarted: number;
      extractions: number;
      deaths: number;
      survivalRate: number;
      survivalRatePct: number;
    };
    survivalRate: number;
    goldExtracted: number;
    chestsOpened: number;
    mimicsFound: number;
    bossesDefeated: number;
    avgGearScore: number;
    economy: {
      totalGoldExtracted: number;
      chestsOpened: number;
      mimicsFound: number;
      bossesDefeated: number;
      avgGearScore: number;
    };
    eventBreakdown: Record<string, number>;
    hourlyActivity: Array<{ hour: string; count: number; sessions: number; raids: number; extractions: number; deaths: number }>;
  }> {
    // Calcul depuis la base de données PostgreSQL si active, sinon depuis le buffer mémoire
    if (Database.isConnected()) {
      try {
        let intervalSql = "INTERVAL '24 hours'";
        if (timeframe === '1h') intervalSql = "INTERVAL '1 hour'";
        else if (timeframe === '7d') intervalSql = "INTERVAL '7 days'";
        else if (timeframe === '30d') intervalSql = "INTERVAL '30 days'";
        else if (timeframe === 'all') intervalSql = "INTERVAL '100 years'";

        // 1. Comptages globaux par type d'événement
        const countsRes = await Database.query(`
          SELECT event_type, COUNT(*) as count
          FROM game_events
          WHERE created_at >= NOW() - ${intervalSql}
          GROUP BY event_type;
        `);

        const breakdown: Record<string, number> = {};
        for (const row of countsRes.rows) {
          breakdown[row.event_type] = Number(row.count);
        }

        const sessionsCount = breakdown['session_start'] ?? 0;
        const queueJoins = breakdown['queue_join'] ?? 0;
        const raidsStarted = breakdown['raid_start'] ?? 0;
        const extractions = breakdown['raid_extract'] ?? 0;
        const deaths = breakdown['raid_death'] ?? 0;
        const chestsOpened = breakdown['chest_open'] ?? 0;
        const bossesDefeated = breakdown['boss_kill'] ?? 0;
        const totalOutcomes = extractions + deaths;
        const survivalRatePct = totalOutcomes > 0 ? Math.round((extractions / totalOutcomes) * 100) : 0;

        // 2. Économie et moyennes
        const ecoRes = await Database.query(`
          SELECT 
            COALESCE(SUM((data->>'coins')::numeric), 0) as total_gold,
            COALESCE(AVG(gear_score), 0) as avg_gs,
            COUNT(*) FILTER (WHERE event_type = 'chest_open' AND (data->>'isMimic')::boolean = true) as mimics
          FROM game_events
          WHERE created_at >= NOW() - ${intervalSql};
        `);

        const totalGoldExtracted = Number(ecoRes.rows[0]?.total_gold ?? 0);
        const avgGearScore = Math.round(Number(ecoRes.rows[0]?.avg_gs ?? 0));
        const mimicsFound = Number(ecoRes.rows[0]?.mimics ?? 0);

        // 3. Activité heure par heure (pour les graphiques)
        const hourlyRes = await Database.query(`
          SELECT 
            TO_CHAR(created_at, 'HH24') as hour,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE event_type = 'session_start') as sessions,
            COUNT(*) FILTER (WHERE event_type = 'raid_start') as raids,
            COUNT(*) FILTER (WHERE event_type = 'raid_extract') as extractions,
            COUNT(*) FILTER (WHERE event_type = 'raid_death') as deaths
          FROM game_events
          WHERE created_at >= NOW() - ${intervalSql}
          GROUP BY TO_CHAR(created_at, 'HH24')
          ORDER BY TO_CHAR(created_at, 'HH24') ASC;
        `);

        const hourlyMap = new Map<string, any>();
        for (const r of hourlyRes.rows) {
          hourlyMap.set(r.hour, {
            hour: r.hour,
            count: Number(r.total_count),
            sessions: Number(r.sessions),
            raids: Number(r.raids),
            extractions: Number(r.extractions),
            deaths: Number(r.deaths),
          });
        }

        const hourlyActivity: Array<{ hour: string; count: number; sessions: number; raids: number; extractions: number; deaths: number }> = [];
        const currentH = new Date().getHours();
        for (let i = 23; i >= 0; i--) {
          const h = (currentH - i + 24) % 24;
          const hStr = h.toString().padStart(2, '0');
          hourlyActivity.push(hourlyMap.get(hStr) || {
            hour: hStr,
            count: 0,
            sessions: 0,
            raids: 0,
            extractions: 0,
            deaths: 0,
          });
        }

        return {
          funnel: {
            sessions: sessionsCount,
            sessionsCount,
            queueJoins,
            raidsStarted,
            extractions,
            deaths,
            survivalRate: survivalRatePct,
            survivalRatePct,
          },
          survivalRate: survivalRatePct,
          goldExtracted: totalGoldExtracted,
          chestsOpened,
          mimicsFound,
          bossesDefeated,
          avgGearScore,
          economy: {
            totalGoldExtracted,
            chestsOpened,
            mimicsFound,
            bossesDefeated,
            avgGearScore,
          },
          eventBreakdown: breakdown,
          hourlyActivity,
        };
      } catch (err: any) {
        console.warn('[Analytics] Erreur requête SQL analytics, bascule sur mémoire:', err.message);
      }
    }

    // Fallback mémoire (si Postgres est hors-ligne)
    return this.calculateMemorySummary();
  }

  private calculateMemorySummary(): {
    funnel: {
      sessions: number;
      sessionsCount: number;
      queueJoins: number;
      raidsStarted: number;
      extractions: number;
      deaths: number;
      survivalRate: number;
      survivalRatePct: number;
    };
    survivalRate: number;
    goldExtracted: number;
    chestsOpened: number;
    mimicsFound: number;
    bossesDefeated: number;
    avgGearScore: number;
    economy: {
      totalGoldExtracted: number;
      chestsOpened: number;
      mimicsFound: number;
      bossesDefeated: number;
      avgGearScore: number;
    };
    eventBreakdown: Record<string, number>;
    hourlyActivity: Array<{ hour: string; count: number; sessions: number; raids: number; extractions: number; deaths: number }>;
  } {
    const breakdown: Record<string, number> = {};
    let totalGoldExtracted = 0;
    let mimicsFound = 0;
    let gsSum = 0;
    let gsCount = 0;

    for (const ev of this.memoryEvents) {
      breakdown[ev.eventType] = (breakdown[ev.eventType] || 0) + 1;
      if (ev.eventType === 'raid_extract') {
        totalGoldExtracted += Number(ev.data?.coins || 0);
        if (ev.gearScore > 0) {
          gsSum += ev.gearScore;
          gsCount++;
        }
      }
      if (ev.eventType === 'chest_open' && ev.data?.isMimic) {
        mimicsFound++;
      }
    }

    const sessionsCount = breakdown['session_start'] ?? 0;
    const queueJoins = breakdown['queue_join'] ?? 0;
    const raidsStarted = breakdown['raid_start'] ?? 0;
    const extractions = breakdown['raid_extract'] ?? 0;
    const deaths = breakdown['raid_death'] ?? 0;
    const chestsOpened = breakdown['chest_open'] ?? 0;
    const bossesDefeated = breakdown['boss_kill'] ?? 0;
    const totalOutcomes = extractions + deaths;
    const survivalRatePct = totalOutcomes > 0 ? Math.round((extractions / totalOutcomes) * 100) : 0;
    const avgGearScore = gsCount > 0 ? Math.round(gsSum / gsCount) : 0;

    // Création des 24 créneaux horaires
    const hourlyActivity: Array<{ hour: string; count: number; sessions: number; raids: number; extractions: number; deaths: number }> = [];
    const currentHour = new Date().getHours();
    for (let i = 23; i >= 0; i--) {
      const h = (currentHour - i + 24) % 24;
      const hourStr = h.toString().padStart(2, '0');
      hourlyActivity.push({
        hour: hourStr,
        count: 0,
        sessions: 0,
        raids: 0,
        extractions: 0,
        deaths: 0,
      });
    }

    // Répartir dans le dernier créneau
    const lastBucket = hourlyActivity[hourlyActivity.length - 1];
    if (lastBucket) {
      lastBucket.count = this.memoryEvents.length;
      lastBucket.sessions = sessionsCount;
      lastBucket.raids = raidsStarted;
      lastBucket.extractions = extractions;
      lastBucket.deaths = deaths;
    }

    return {
      funnel: {
        sessions: sessionsCount,
        sessionsCount,
        queueJoins,
        raidsStarted,
        extractions,
        deaths,
        survivalRate: survivalRatePct,
        survivalRatePct,
      },
      survivalRate: survivalRatePct,
      goldExtracted: totalGoldExtracted,
      chestsOpened,
      mimicsFound,
      bossesDefeated,
      avgGearScore,
      economy: {
        totalGoldExtracted,
        chestsOpened,
        mimicsFound,
        bossesDefeated,
        avgGearScore,
      },
      eventBreakdown: breakdown,
      hourlyActivity,
    };
  }

  // =========================================================================
  // RÉCUPÉRATION DU JOURNAL DES ÉVÉNEMENTS (LOGS PAGINÉS)
  // =========================================================================

  public async getEvents(options: {
    limit?: number;
    offset?: number;
    type?: string;
    eventType?: string;
    playerId?: string;
    search?: string;
  } = {}): Promise<GameEvent[] & { total: number; events: GameEvent[] }> {
    const limit = Math.min(200, Math.max(1, options.limit ?? 50));
    const offset = Math.max(0, options.offset ?? 0);
    const typeFilter = (options.eventType || options.type)?.trim();
    const playerIdFilter = options.playerId?.trim();
    const search = options.search?.trim().toLowerCase();

    if (Database.isConnected()) {
      try {
        let whereClauses: string[] = [];
        const params: any[] = [];

        if (typeFilter) {
          params.push(typeFilter);
          whereClauses.push(`event_type = $${params.length}`);
        }

        if (playerIdFilter) {
          params.push(playerIdFilter);
          whereClauses.push(`user_id = $${params.length}`);
        }

        if (search) {
          params.push(`%${search}%`);
          whereClauses.push(`(player_name ILIKE $${params.length} OR instance_id ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countRes = await Database.query(`SELECT COUNT(*) as total FROM game_events ${whereSql};`, params);
        const total = Number(countRes.rows[0]?.total ?? 0);

        params.push(limit);
        params.push(offset);
        const eventsRes = await Database.query(
          `SELECT id, event_type, player_name, is_guest, user_id, gear_score, instance_id, data, created_at
           FROM game_events ${whereSql}
           ORDER BY created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length};`,
          params
        );

        const events: GameEvent[] = eventsRes.rows.map((r) => ({
          id: r.id,
          eventType: r.event_type,
          playerName: r.player_name,
          isGuest: r.is_guest,
          userId: r.user_id,
          gearScore: r.gear_score,
          instanceId: r.instance_id,
          data: r.data ?? {},
          createdAt: r.created_at,
        }));

        const result = Object.assign(events, { total, events });
        return result;
      } catch (err: any) {
        console.warn('[Analytics] Échec requête DB getEvents, bascule mémoire:', err.message);
      }
    }

    // Filtrage mémoire
    let filtered = this.memoryEvents;
    if (typeFilter) {
      filtered = filtered.filter((e) => e.eventType === typeFilter);
    }
    if (playerIdFilter) {
      filtered = filtered.filter((e) => e.userId === playerIdFilter);
    }
    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.playerName.toLowerCase().includes(search) ||
          (e.instanceId && e.instanceId.toLowerCase().includes(search))
      );
    }

    const sliced = filtered.slice(offset, offset + limit);
    return Object.assign(sliced, { total: filtered.length, events: sliced });
  }
}
