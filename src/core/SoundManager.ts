const SOUND_EFFECT_URLS = {
  button: new URL('../assets/audio/effects/button.mp3', import.meta.url).href,
  chestOpening: new URL('../assets/audio/effects/chestopening.mp3', import.meta.url).href,
  slimeDeath: new URL('../assets/audio/effects/SlimeDeath.mp3', import.meta.url).href,
  equipItem: new URL('../assets/audio/effects/equipItem.mp3', import.meta.url).href,
  keyLoot: new URL('../assets/audio/effects/keyLoot.mp3', import.meta.url).href,
  playerSteps: new URL('../assets/audio/effects/playerSteps.wav', import.meta.url).href,
};

const menuMusicUrl = new URL('../assets/audio/music/menuhub.mp3', import.meta.url).href;

export const BOSS_MUSIC_URLS = {
  bloodQueen: new URL('../assets/audio/music/bloodQueen.mp3', import.meta.url).href,
  cakeBoss: new URL('../assets/audio/music/cakeBoss.mp3', import.meta.url).href,
} as const;

export type BossMusicName = keyof typeof BOSS_MUSIC_URLS;

export type SoundEffectName = keyof typeof SOUND_EFFECT_URLS;

export interface PlayOptions {
  volume?: number;
  pitchVariation?: number;
}

export interface Play3DOptions extends PlayOptions {
  refDistance?: number;
  maxDistance?: number;
  rolloff?: number;
}

/**
 * Moteur audio 3D spatialisé et gestionnaire sonore centralisé pour The Old Citadel :
 * - Rendu stéréo spatialisé 3D (panoramique directionnel gauche/droite selon l'angle de vue du joueur)
 * - Atténuation de distance réaliste avec adoucissement aux limites de portée
 * - Filtrage acoustique avant/arrière (occlusion naturelle de la tête par filtre passe-bas pour différencier l'avant et l'arrière)
 * - Variations subtiles de hauteur (pitch) pour un rendu organique non-répétitif
 * - Musique d'ambiance en boucle (Menu principal & Hub) avec fondu progressif en début de partie
 * - Rétro-compatibilité et résilience complète (gestion autoplay, mode sans échec Node.js pour les tests CI)
 */
export class SoundManager {
  private static isInitialized = false;

  // Web Audio Context & Buffers décodés pour une latence nulle
  private static audioCtx: AudioContext | null = null;
  private static readonly soundBuffers = new Map<SoundEffectName, AudioBuffer>();
  private static readonly loadingPromises = new Map<SoundEffectName, Promise<AudioBuffer | null>>();

  // Position et angle de la caméra de l'écouteur (joueur local ou coéquipier observé)
  private static listenerX = 0;
  private static listenerY = 0;
  private static listenerAngle = 0;

  // Musique de fond (Menu / Hub)
  private static musicAudio: HTMLAudioElement | null = null;
  private static isMusicPlaying = false;
  private static pendingMenuMusic = false;

  // Musiques de combat des Boss
  private static readonly bossAudios = new Map<BossMusicName, HTMLAudioElement>();
  private static currentBossMusicName: BossMusicName | null = null;
  private static currentBossAudio: HTMLAudioElement | null = null;
  private static isBossMusicPlaying = false;
  private static pendingBossMusic: BossMusicName | null = null;

  // Fallback pool pour clics de boutons si AudioContext n'est pas encore débloqué
  private static buttonPool: HTMLAudioElement[] = [];
  private static poolIndex = 0;
  private static readonly POOL_SIZE = 6;

  private static musicVolume = 0.35;
  private static sfxVolume = 0.50;

  public static init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }
    this.isInitialized = true;

    // 1. Initialisation de l'AudioContext Web Audio
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    } catch (err) {
      console.warn('[SoundManager] Web Audio API non supportée ou restreinte :', err);
    }

    // 2. Préchargement et décodage de tous les effets sonores en mémoire vive (latence 0ms)
    this.preloadAllEffects();

    // 3. Initialisation de la musique du menu / hub
    try {
      this.musicAudio = new Audio(menuMusicUrl);
      this.musicAudio.loop = true;
      this.musicAudio.volume = this.musicVolume;
      this.musicAudio.preload = 'auto';
    } catch (err) {
      console.warn('[SoundManager] Impossible d initialiser la musique :', err);
    }

    // 4. Pré-instanciation des thèmes de boss
    this.preloadBossMusics().catch(() => {});

    // 5. Initialisation du pool de secours HTML5 Audio pour les boutons
    try {
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const sfx = new Audio(SOUND_EFFECT_URLS.button);
        sfx.volume = this.sfxVolume;
        sfx.preload = 'auto';
        this.buttonPool.push(sfx);
      }
    } catch (err) {
      console.warn('[SoundManager] Impossible d initialiser le pool SFX de secours :', err);
    }

    // 6. Écouteur global capturant tous les clics sur des boutons d'interface
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          const target = (e.target as HTMLElement | null)?.closest(
            'button, a.main-menu-bmac-btn, [role="button"], input[type="button"], input[type="submit"]'
          );
          if (!target) return;

          // Ignorer les boutons désactivés ou grisés
          if (
            target.hasAttribute('disabled') ||
            target.classList.contains('disabled') ||
            target.classList.contains('hub-nav-tab-disabled')
          ) {
            return;
          }

          this.playButtonSound();
        },
        true // Phase de capture : intercepte même si stopPropagation a été appelé
      );

      // 7. Déblocage automatique de l'audio dès la première interaction utilisateur
      const unlockAutoplay = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (this.pendingMenuMusic && this.musicAudio && this.isMusicPlaying) {
          this.musicAudio.play().catch(() => {});
          this.pendingMenuMusic = false;
        }
        if (this.pendingBossMusic && this.isBossMusicPlaying) {
          const bossAudio = this.bossAudios.get(this.pendingBossMusic);
          if (bossAudio) {
            bossAudio.play().catch(() => {});
          }
          this.pendingBossMusic = null;
        }
      };

      window.addEventListener('pointerdown', unlockAutoplay, { passive: true });
      window.addEventListener('keydown', unlockAutoplay, { passive: true });
    }
  }

  /**
   * Précharge et décode tous les effets sonores dans l'AudioContext.
   */
  public static async preloadAllEffects(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (!this.audioCtx) return;
    const keys = Object.keys(SOUND_EFFECT_URLS) as SoundEffectName[];
    await Promise.all(keys.map((key) => this.loadSoundBuffer(key)));
  }

  /**
   * Charge et décode un son individuel.
   */
  private static async loadSoundBuffer(name: SoundEffectName): Promise<AudioBuffer | null> {
    if (this.soundBuffers.has(name)) {
      return this.soundBuffers.get(name)!;
    }
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }
    if (!this.audioCtx) return null;

    const url = SOUND_EFFECT_URLS[name];
    const promise = (async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await this.audioCtx!.decodeAudioData(arrayBuffer);
        this.soundBuffers.set(name, decoded);
        return decoded;
      } catch (err) {
        console.warn(`[SoundManager] Erreur décodage de ${name} (${url}) :`, err);
        return null;
      } finally {
        this.loadingPromises.delete(name);
      }
    })();

    this.loadingPromises.set(name, promise);
    return promise;
  }

  /**
   * Met à jour la position et l'orientation angulaire de l'écouteur (la caméra).
   */
  public static updateListener(x: number, y: number, angle: number): void {
    this.listenerX = x;
    this.listenerY = y;
    this.listenerAngle = angle;
  }

  public static getListener(): { x: number; y: number; angle: number } {
    return { x: this.listenerX, y: this.listenerY, angle: this.listenerAngle };
  }

  /**
   * Calcule les paramètres acoustiques 3D (distance, atténuation, panoramique stéréo, occlusion arrière)
   */
  public static calculateSpatialAudio(
    sourceX: number,
    sourceY: number,
    listenerX: number = this.listenerX,
    listenerY: number = this.listenerY,
    listenerAngle: number = this.listenerAngle,
    options?: Play3DOptions
  ): {
    distance: number;
    attenuation: number;
    pan: number;
    isBehind: boolean;
    behindFactor: number;
    relativeAngle: number;
    audible: boolean;
  } {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const distance = Math.hypot(dx, dy);

    const refDist = options?.refDistance ?? 1.2;
    const maxDist = options?.maxDistance ?? 18.0;

    if (distance > maxDist) {
      return {
        distance,
        attenuation: 0,
        pan: 0,
        isBehind: false,
        behindFactor: 0,
        relativeAngle: 0,
        audible: false,
      };
    }

    const distCutoff = Math.max(0, 1 - (distance - refDist) / (maxDist - refDist));
    const attenuation =
      distance <= refDist
        ? 1.0
        : (refDist / (refDist + 0.85 * (distance - refDist))) * distCutoff;

    const angleToSource = Math.atan2(dy, dx);
    let dAngle = angleToSource - listenerAngle;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;

    const pan = distance < 0.08 ? 0 : Math.sin(dAngle);
    const isBehind = Math.cos(dAngle) < 0;
    const behindFactor = isBehind ? Math.max(0, -Math.cos(dAngle)) : 0;

    return {
      distance,
      attenuation,
      pan,
      isBehind,
      behindFactor,
      relativeAngle: dAngle,
      audible: attenuation > 0.005,
    };
  }

  /**
   * Joue un son spatialisé en 3D stéréo à des coordonnées du monde (x, y).
   * Calcule le panoramique gauche/droite en temps réel et l'atténuation selon la distance.
   */
  public static play3D(
    soundName: SoundEffectName,
    sourceX: number,
    sourceY: number,
    options?: Play3DOptions
  ): void {
    if (typeof window === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const spatial = this.calculateSpatialAudio(
      sourceX,
      sourceY,
      this.listenerX,
      this.listenerY,
      this.listenerAngle,
      options
    );

    if (!spatial.audible) return;

    const baseVolume = options?.volume ?? 1.0;
    const finalVolume = baseVolume * this.sfxVolume * spatial.attenuation;

    if (finalVolume < 0.005) return;

    const buffer = this.soundBuffers.get(soundName);
    if (buffer) {
      this.spawnAudioGraph(
        buffer,
        spatial.pan,
        finalVolume,
        spatial.behindFactor,
        options?.pitchVariation
      );
    } else {
      // Si le buffer n'a pas fini de charger, on tente de le récupérer
      this.loadSoundBuffer(soundName).then((loaded) => {
        if (loaded) {
          this.spawnAudioGraph(
            loaded,
            spatial.pan,
            finalVolume,
            spatial.behindFactor,
            options?.pitchVariation
          );
        }
      });
    }
  }

  /**
   * Joue un son direct 2D (sans atténuation spatiale), par exemple les actions du joueur ou l'UI.
   */
  public static play2D(soundName: SoundEffectName, options?: PlayOptions): void {
    if (typeof window === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const baseVolume = options?.volume ?? 1.0;
    const finalVolume = baseVolume * this.sfxVolume;

    const buffer = this.soundBuffers.get(soundName);
    if (buffer) {
      this.spawnAudioGraph(buffer, 0, finalVolume, 0, options?.pitchVariation);
    } else {
      this.loadSoundBuffer(soundName).then((loaded) => {
        if (loaded) {
          this.spawnAudioGraph(loaded, 0, finalVolume, 0, options?.pitchVariation);
        }
      });
    }
  }

  /**
   * Instancie le graphe de nœuds Web Audio pour diffuser le son en stéréo 3D.
   */
  private static spawnAudioGraph(
    buffer: AudioBuffer,
    pan: number,
    volume: number,
    behindFactor: number,
    pitchVariation = 0
  ): void {
    if (!this.audioCtx) return;

    try {
      const sourceNode = this.audioCtx.createBufferSource();
      sourceNode.buffer = buffer;

      if (pitchVariation > 0) {
        sourceNode.playbackRate.value = 1.0 + (Math.random() - 0.5) * 2 * pitchVariation;
      }

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = volume;

      let lastNode: AudioNode = sourceNode;

      // Filtre passe-bas subtil si le son est derrière pour simuler l'occlusion de la tête
      if (behindFactor > 0.05 && this.audioCtx.createBiquadFilter) {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 20000 - behindFactor * 16000; // 20kHz -> 4kHz
        lastNode.connect(filter);
        lastNode = filter;
      }

      // Panoramique stéréo gauche / droite
      if (this.audioCtx.createStereoPanner) {
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        lastNode.connect(panner);
        lastNode = panner;
      }

      lastNode.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      sourceNode.start(0);

      sourceNode.onended = () => {
        try {
          sourceNode.disconnect();
          gainNode.disconnect();
        } catch {
          // Déconnexion propre
        }
      };
    } catch (err) {
      console.warn('[SoundManager] Erreur lors de la lecture audio :', err);
    }
  }

  /**
   * Déclenche le son de clic de bouton (utilise Web Audio ou le pool HTML5 de secours).
   */
  public static playButtonSound(): void {
    if (typeof window === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }

    if (this.soundBuffers.has('button') && this.audioCtx && this.audioCtx.state === 'running') {
      this.play2D('button', { volume: 0.55 });
      return;
    }

    if (this.buttonPool.length === 0) return;
    const sfx = this.buttonPool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.buttonPool.length;

    try {
      sfx.currentTime = 0;
      sfx.volume = this.sfxVolume;
      const promise = sfx.play();
      if (promise !== undefined) {
        promise.catch(() => {});
      }
    } catch {
      // Ignoré
    }
  }

  /**
   * Lance la musique d'ambiance du Menu / Hub.
   * Si elle est déjà en cours de lecture, ne la redémarre pas.
   */
  public static playMenuMusic(): void {
    if (typeof window === 'undefined') return;
    if (!this.isInitialized) {
      this.init();
    }
    if (!this.musicAudio) return;

    if (this.isMusicPlaying && !this.musicAudio.paused) {
      return;
    }

    this.isMusicPlaying = true;
    this.musicAudio.volume = this.musicVolume;

    const playPromise = this.musicAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay bloqué par le navigateur : attente du premier clic
        this.pendingMenuMusic = true;
      });
    }
  }

  /**
   * Arrête la musique du menu avec un fondu doux lors du départ en partie.
   */
  public static stopMenuMusic(fadeDurationMs = 350): void {
    this.pendingMenuMusic = false;
    this.isMusicPlaying = false;

    if (!this.musicAudio || typeof window === 'undefined') return;

    if (fadeDurationMs <= 0) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      return;
    }

    const startVol = this.musicAudio.volume;
    const startTime = performance.now();

    const fadeStep = () => {
      if (!this.musicAudio || this.isMusicPlaying) return;

      const elapsed = performance.now() - startTime;
      if (elapsed < fadeDurationMs) {
        this.musicAudio.volume = Math.max(0, startVol * (1 - elapsed / fadeDurationMs));
        requestAnimationFrame(fadeStep);
      } else {
        this.musicAudio.pause();
        this.musicAudio.currentTime = 0;
        this.musicAudio.volume = this.musicVolume;
      }
    };

    fadeStep();
  }

  /**
   * Associe un identifiant d'ennemi ou de boss au fichier audio correspondant.
   * Gère:
   * - blood_queen / bloodQueen / Reine de Sang -> bloodQueen.mp3
   * - carrot_cake_king / cakeBoss / cakeKing / Roi Gâteau -> cakeBoss.mp3
   */
  public static resolveBossMusic(bossIdentifier: string): BossMusicName | null {
    if (!bossIdentifier) return null;
    const norm = bossIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      norm.includes('blood') ||
      norm.includes('queen') ||
      norm.includes('reine') ||
      norm.includes('sang') ||
      norm.includes('blob')
    ) {
      return 'bloodQueen';
    }
    if (
      norm.includes('cake') ||
      norm.includes('carrot') ||
      norm.includes('carotte') ||
      norm.includes('gateau')
    ) {
      return 'cakeBoss';
    }
    return null;
  }

  /**
   * Précharge les fichiers audio des musiques de boss.
   */
  public static async preloadBossMusics(): Promise<void> {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const keys = Object.keys(BOSS_MUSIC_URLS) as BossMusicName[];
    await Promise.all(
      keys.map(async (key) => {
        try {
          if (!this.bossAudios.has(key)) {
            const audio = new Audio(BOSS_MUSIC_URLS[key]);
            audio.preload = 'auto';
            audio.loop = true;
            audio.volume = this.musicVolume;
            this.bossAudios.set(key, audio);
          }
        } catch (err) {
          console.warn(`[SoundManager] Erreur préchargement boss music ${key} :`, err);
        }
      })
    );
  }

  /**
   * Lance la musique de combat épique du boss spécifié.
   * Si la musique est déjà active, ne la redémarre pas.
   */
  public static playBossMusic(name: BossMusicName, fadeInMs = 400): void {
    if (this.currentBossMusicName === name && this.isBossMusicPlaying) {
      return;
    }

    if (this.currentBossAudio && this.currentBossMusicName !== name) {
      this.stopBossMusic(150);
    }

    // Assure l'arrêt immédiat de la musique de menu / hub
    this.stopMenuMusic(150);

    this.currentBossMusicName = name;
    this.isBossMusicPlaying = true;
    this.pendingBossMusic = null;

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }

    let audio = this.bossAudios.get(name);
    if (!audio) {
      try {
        audio = new Audio(BOSS_MUSIC_URLS[name]);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = this.musicVolume;
        this.bossAudios.set(name, audio);
      } catch (err) {
        console.warn(`[SoundManager] Erreur création audio boss ${name} :`, err);
        return;
      }
    }

    this.currentBossAudio = audio;

    try {
      audio.currentTime = 0;
      if (fadeInMs > 0 && typeof requestAnimationFrame !== 'undefined') {
        audio.volume = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.pendingBossMusic = name;
          });
        }

        const targetVolume = this.musicVolume;
        const startTime = performance.now();
        const fadeInStep = () => {
          if (this.currentBossAudio !== audio || !this.isBossMusicPlaying) return;
          const elapsed = performance.now() - startTime;
          if (elapsed < fadeInMs) {
            audio.volume = Math.min(targetVolume, targetVolume * (elapsed / fadeInMs));
            requestAnimationFrame(fadeInStep);
          } else {
            audio.volume = targetVolume;
          }
        };
        requestAnimationFrame(fadeInStep);
      } else {
        audio.volume = this.musicVolume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.pendingBossMusic = name;
          });
        }
      }
    } catch (err) {
      console.warn(`[SoundManager] Erreur lecture musique boss ${name} :`, err);
    }
  }

  /**
   * Joue la musique de combat correspondant à un type d'ennemi boss.
   */
  public static playBossMusicForEnemy(enemyTypeId: string, fadeInMs = 400): void {
    const musicName = this.resolveBossMusic(enemyTypeId);
    if (musicName) {
      this.playBossMusic(musicName, fadeInMs);
    }
  }

  /**
   * Arrête la musique de combat de boss avec un fondu doux.
   */
  public static stopBossMusic(fadeDurationMs = 800): void {
    this.pendingBossMusic = null;
    this.isBossMusicPlaying = false;
    const stoppingMusic = this.currentBossAudio;
    this.currentBossMusicName = null;
    this.currentBossAudio = null;

    if (!stoppingMusic || typeof window === 'undefined') {
      return;
    }

    if (fadeDurationMs <= 0 || typeof requestAnimationFrame === 'undefined') {
      try {
        stoppingMusic.pause();
        stoppingMusic.currentTime = 0;
      } catch {}
      stoppingMusic.volume = this.musicVolume;
      return;
    }

    const startVol = stoppingMusic.volume;
    const startTime = performance.now();

    const fadeStep = () => {
      // Si une nouvelle musique de boss a été réengagée pour ce même audio, on n'éteint pas
      if (this.currentBossAudio === stoppingMusic && this.isBossMusicPlaying) {
        return;
      }

      const elapsed = performance.now() - startTime;
      if (elapsed < fadeDurationMs) {
        stoppingMusic.volume = Math.max(0, startVol * (1 - elapsed / fadeDurationMs));
        requestAnimationFrame(fadeStep);
      } else {
        try {
          stoppingMusic.pause();
          stoppingMusic.currentTime = 0;
        } catch {}
        stoppingMusic.volume = this.musicVolume;
      }
    };

    fadeStep();
  }

  /**
   * Retourne le nom de la musique de boss actuellement active, ou null.
   */
  public static getCurrentBossMusic(): BossMusicName | null {
    return this.isBossMusicPlaying ? this.currentBossMusicName : null;
  }

  /**
   * Indique si un thème musical de boss est en train d'être joué.
   */
  public static isBossMusicActive(): boolean {
    return this.isBossMusicPlaying && this.currentBossMusicName !== null;
  }

  public static setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicVolume;
    }
    if (this.currentBossAudio && this.isBossMusicPlaying) {
      this.currentBossAudio.volume = this.musicVolume;
    }
    for (const audio of this.bossAudios.values()) {
      if (audio !== this.currentBossAudio) {
        audio.volume = this.musicVolume;
      }
    }
  }

  public static setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    for (const sfx of this.buttonPool) {
      sfx.volume = this.sfxVolume;
    }
  }
}
