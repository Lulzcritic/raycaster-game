import type { GameMap } from '../world/GameMap';
import { Entity } from './Entity';
import type { Player } from './Player';

type ArrowState = 'flying' | 'impact';

export class Arrow extends Entity {
  private static directionalFrames: HTMLCanvasElement[] | null = null;
  private static impactFrames: HTMLCanvasElement[] | null = null;

  public readonly damage: number;
  private readonly player?: Player;
  private state: ArrowState = 'flying';
  private distanceTraveled = 0;
  private impactTimer = 0;

  public static readonly SPEED = 5.2; // Vitesse de vol vive
  public static readonly MAX_DISTANCE = 16.0; // Portée maximale
  public static readonly IMPACT_DURATION = 0.16; // Durée de l'impact

  constructor(x: number, y: number, angle: number, damage = 14, player?: Player) {
    super(x, y, angle, 0.12);
    this.damage = damage;
    this.player = player;
    Arrow.ensureSpritesCreated();
  }

  public isFlying(): boolean {
    return this.active && this.state === 'flying';
  }

  public hitTarget(): void {
    if (this.state !== 'impact') {
      this.state = 'impact';
      this.impactTimer = 0;
    }
  }

  public override isFloorAnchored(): boolean {
    // Faux : la flèche vole en suspension à hauteur de torse
    return false;
  }

  public override getElevation(): number {
    return 0;
  }

  public override getScale(): number {
    if (this.state === 'impact') {
      return 0.35;
    }
    return 0.28;
  }

  public update(deltaTime: number, map: GameMap): void {
    if (!this.active) {
      return;
    }

    if (this.state === 'impact') {
      this.impactTimer += deltaTime;
      if (this.impactTimer >= Arrow.IMPACT_DURATION) {
        this.active = false;
      }
      return;
    }

    // Progression de la flèche
    const stepDistance = Arrow.SPEED * deltaTime;
    const nextX = this.x + Math.cos(this.angle) * stepDistance;
    const nextY = this.y + Math.sin(this.angle) * stepDistance;

    // Collision contre un mur ou sortie de la carte
    if (map.isOutOfBounds(nextX, nextY) || map.isWall(nextX, nextY)) {
      this.hitTarget();
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.distanceTraveled += stepDistance;

    if (this.distanceTraveled >= Arrow.MAX_DISTANCE) {
      this.active = false;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (this.state === 'impact') {
      const frames = Arrow.impactFrames;
      if (!frames || frames.length === 0) return null;
      const progress = Math.min(0.99, this.impactTimer / Arrow.IMPACT_DURATION);
      const frameIdx = Math.floor(progress * frames.length);
      return frames[frameIdx] ?? frames[0];
    }

    const frames = Arrow.directionalFrames;
    if (!frames || frames.length === 0) return null;

    if (!this.player) {
      return frames[0]; // Vue de face par défaut
    }

    // Calcul de l'angle relatif pour sélectionner la vue 8 directions
    const dx = this.player.x - this.x;
    const dy = this.player.y - this.y;
    const angleToPlayer = Math.atan2(dy, dx);

    let diff = this.angle - angleToPlayer;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const octant = Math.floor(
      ((diff + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4)
    );

    return frames[octant % frames.length] ?? frames[0];
  }

  private static ensureSpritesCreated(): void {
    if (this.directionalFrames && this.impactFrames) {
      return;
    }

    const size = 32;
    this.directionalFrames = [];

    // Création des 8 vues directionnelles de la flèche
    for (let octant = 0; octant < 8; octant++) {
      this.directionalFrames.push(this.createDirectionalArrowCanvas(size, octant));
    }

    // Création des 2 frames d'impact
    this.impactFrames = [
      this.createImpactCanvas(size, 0),
      this.createImpactCanvas(size, 1),
    ];
  }

  /**
   * Génère une frame directionnelle en pixel-art selon l'angle d'observation :
   * octant 0 : face (vient vers nous)
   * octant 1 : biais avant-droit
   * octant 2 : profil droit
   * octant 3 : biais arrière-droit
   * octant 4 : dos (s'éloigne de nous)
   * octant 5 : biais arrière-gauche
   * octant 6 : profil gauche
   * octant 7 : biais avant-gauche
   */
  private static createDirectionalArrowCanvas(
    size: number,
    octant: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const cx = size / 2;
    const cy = size / 2;

    if (octant === 0) {
      // Vue de face : pointe métallique en losange au centre, reflet d'acier et plumes visibles en retrait
      // Empennage en arrière-plan (gris/blanc atténué)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx - 3, cy - 3, 7, 7);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx - 2, cy - 2, 5, 5);

      // Fût en bois
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 1, cy - 1, 3, 3);

      // Pointe d'acier triangulaire/losange menaçante
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 2, cy - 1, 5, 3);
      ctx.fillRect(cx - 1, cy - 2, 3, 5);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cx - 1, cy - 1, 3, 3);

      // Éclat d'acier incandescent au centre
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy, 1, 1);
      return canvas;
    }

    if (octant === 4) {
      // Vue de dos : empennage en croix de plumes blanches et encoche
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 3, cy, 7, 1);
      ctx.fillRect(cx, cy - 3, 1, 7);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx - 2, cy - 1, 5, 3);
      ctx.fillRect(cx - 1, cy - 2, 3, 5);

      ctx.fillStyle = '#451a03';
      ctx.fillRect(cx, cy, 1, 1);
      return canvas;
    }

    // Vues inclinées ou de profil : on dessine un profil de base puis on applique rotation/symétrie
    // Angle en radians selon l'octant
    // octant 2 = vers la droite (+X) = 0 rad
    // octant 6 = vers la gauche (-X) = PI rad
    const angles = [
      0, // octant 0 (non utilisé ici)
      Math.PI / 4, // 1 : vers le bas-droite
      0, // 2 : vers la droite
      -Math.PI / 4, // 3 : vers le haut-droite
      Math.PI, // 4 (non utilisé ici)
      Math.PI + Math.PI / 4, // 5 : vers le haut-gauche
      Math.PI, // 6 : vers la gauche
      Math.PI - Math.PI / 4, // 7 : vers le bas-gauche
    ];

    const rotAngle = angles[octant] ?? 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotAngle);

    // Dessin de la flèche de profil orientée vers la droite (+X)
    // 1. Empennage (plumes blanches et encoche) à gauche (x de -12 à -6)
    ctx.fillStyle = '#334155'; // Contour plumes
    ctx.fillRect(-12, -3, 6, 7);
    ctx.fillStyle = '#f8fafc'; // Plumes blanches
    ctx.fillRect(-11, -2, 5, 5);
    ctx.fillStyle = '#cbd5e1'; // Ombre plumes
    ctx.fillRect(-10, 0, 4, 2);

    // 2. Fût en bois de frêne (x de -6 à +7)
    ctx.fillStyle = '#451a03'; // Contour bois foncé
    ctx.fillRect(-6, -1, 14, 3);
    ctx.fillStyle = '#b45309'; // Bois clair
    ctx.fillRect(-6, 0, 13, 1);

    // 3. Fer de lance / Pointe métallique acérée (x de +7 à +13)
    ctx.fillStyle = '#0f172a'; // Contour noir acier
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(7, -3);
    ctx.lineTo(8, 0);
    ctx.lineTo(7, 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#94a3b8'; // Métal acier
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(8, -2);
    ctx.lineTo(9, 0);
    ctx.lineTo(8, 2);
    ctx.closePath();
    ctx.fill();

    // Éclat tranchant
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11, 0, 2, 1);

    ctx.restore();
    return canvas;
  }

  /**
   * Éclats d'impact de flèche (morceaux de bois et étincelles)
   */
  private static createImpactCanvas(size: number, stage: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    if (stage === 0) {
      // Éclat initial vif au point de contact
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, cy - 2, 5, 5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cx - 4, cy - 1, 9, 3);
      ctx.fillRect(cx - 1, cy - 4, 3, 9);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(cx - 3, cy - 3, 2, 2);
      ctx.fillRect(cx + 2, cy + 2, 2, 2);
    } else {
      // Éclatement des débris et étincelles
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 6, cy - 4, 2, 2);
      ctx.fillRect(cx + 5, cy - 3, 2, 2);
      ctx.fillRect(cx - 4, cy + 5, 2, 2);
      ctx.fillRect(cx + 4, cy + 4, 2, 2);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx - 3, cy - 5, 1, 1);
      ctx.fillRect(cx + 3, cy + 5, 1, 1);
    }

    return canvas;
  }
}
