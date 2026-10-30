import { Entity } from './Entity';
import type { Player } from './Player';

export interface ExtractionInfo {
  name: string;
  isActive: boolean;
  remainingSec: number;
  requiresBoss?: boolean;
}

export class ExtractionPortal extends Entity {
  public readonly name: string;
  public readonly activationDelaySec: number;
  public requiresBoss: boolean;
  private isBossDefeated = false;
  private elapsedTime = 0;
  private animTimer = 0;
  private wasActiveAnnounced = false;
  private readonly onExtract?: (portal: ExtractionPortal, player: Player) => void;
  private static spriteInactive: HTMLCanvasElement | null = null;
  private static spritesActive: HTMLCanvasElement[] | null = null;

  constructor(
    x: number,
    y: number,
    name: string,
    activationDelaySec = 45,
    onExtract?: (portal: ExtractionPortal, player: Player) => void,
    requiresBoss = false
  ) {
    super(x, y, 0, 0.45);
    this.name = name;
    this.activationDelaySec = activationDelaySec;
    this.onExtract = onExtract;
    this.requiresBoss = requiresBoss;
    ExtractionPortal.ensureSprites();
  }

  public override isFloorAnchored(): boolean {
    return true;
  }

  public override getScale(): number {
    return 0.52;
  }

  public isActive(): boolean {
    if (!this.active) {
      return false;
    }
    if (this.requiresBoss && !this.isBossDefeated) {
      return false;
    }
    return this.elapsedTime >= this.activationDelaySec;
  }

  public activateNow(): void {
    this.elapsedTime = Math.max(this.elapsedTime, this.activationDelaySec);
  }

  public unlockByBoss(): void {
    this.isBossDefeated = true;
    this.activateNow();
  }

  public isBossUnlocked(): boolean {
    return this.isBossDefeated;
  }

  public getExtractionInfo(): ExtractionInfo {
    const isWaitingBoss = this.requiresBoss && !this.isBossDefeated;
    const remaining = isWaitingBoss
      ? 999
      : Math.max(0, Math.ceil(this.activationDelaySec - this.elapsedTime));
    return {
      name: this.name,
      isActive: this.isActive(),
      remainingSec: remaining,
      requiresBoss: isWaitingBoss,
    };
  }

  public override isInteractable(): boolean {
    return this.active;
  }

  public override getInteractionPrompt(_player?: Player): string | null {
    if (!this.active) {
      return null;
    }

    if (this.requiresBoss && !this.isBossDefeated) {
      return `🔒 ${this.name.toUpperCase()} (SCELLÉ : VAINQUEZ LE BOSS DU SANCTUAIRE)`;
    }

    if (this.isActive()) {
      return `[F] S'EXTRAIRE DU DONJON : ${this.name.toUpperCase()} (VICTOIRE)`;
    }

    const remaining = Math.max(
      1,
      Math.ceil(this.activationDelaySec - this.elapsedTime)
    );
    return `[F] ${this.name.toUpperCase()} (PORTAIL EN CHARGE : ${remaining}s)`;
  }

  public override interact(player: Player): string | null {
    if (!this.active) {
      return null;
    }

    if (this.requiresBoss && !this.isBossDefeated) {
      return `🔒 CE PORTAIL ROYAL EST SCELLÉ PAR L'ÂME DU BOSS ! TERRASSEZ-LE POUR L'OUVRIR !`;
    }

    if (!this.isActive()) {
      const remaining = Math.max(
        1,
        Math.ceil(this.activationDelaySec - this.elapsedTime)
      );
      return `CE PORTAIL EST ENCORE EN SOMMEIL ! OUVERTURE DANS ${remaining}s.`;
    }

    this.onExtract?.(this, player);
    return `EXTRACTION RÉUSSIE PAR LE ${this.name.toUpperCase()} !`;
  }

  public override update(deltaTime: number): void {
    if (!this.active) {
      return;
    }

    if (!this.requiresBoss || this.isBossDefeated) {
      this.elapsedTime += deltaTime;
    }
    this.animTimer += deltaTime;

    // Détection de l'activation
    if (this.isActive() && !this.wasActiveAnnounced) {
      this.wasActiveAnnounced = true;
    }
  }

  public override getSprite(): HTMLCanvasElement | null {
    if (!this.isActive()) {
      return ExtractionPortal.spriteInactive;
    }

    const activeList = ExtractionPortal.spritesActive;
    if (!activeList || activeList.length === 0) {
      return ExtractionPortal.spriteInactive;
    }

    const frameIdx = Math.floor(this.animTimer * 6) % activeList.length;
    return activeList[frameIdx];
  }

  private static ensureSprites(): void {
    if (this.spriteInactive && this.spritesActive) {
      return;
    }

    this.spriteInactive = this.createInactiveSprite();
    this.spritesActive = [
      this.createActiveSprite(0),
      this.createActiveSprite(1),
      this.createActiveSprite(2),
      this.createActiveSprite(3),
    ];
  }

  private static createInactiveSprite(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Socle de pierre runique sombre au sol
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(32, 54, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Monolithe en obsidienne
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(22, 54);
    ctx.lineTo(26, 16);
    ctx.lineTo(38, 16);
    ctx.lineTo(42, 54);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Runes violettes faibles en veille
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(30, 24, 4, 3);
    ctx.fillRect(31, 31, 2, 8);
    ctx.fillRect(29, 34, 6, 2);
    ctx.fillRect(30, 43, 4, 3);

    // Cristal dormant au sommet
    ctx.fillStyle = '#4338ca';
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(36, 14);
    ctx.lineTo(32, 18);
    ctx.lineTo(28, 14);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  private static createActiveSprite(frame: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const pulse = Math.sin(frame * (Math.PI / 2)) * 2;

    // Halo d'énergie mystique au sol
    const grad = ctx.createRadialGradient(32, 50, 4, 32, 50, 26 + pulse);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
    grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.45)');
    grad.addColorStop(1, 'rgba(3, 105, 161, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(32, 52, 26 + pulse, 9 + pulse * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Colonnes d'obsidienne luminescente
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 26, 5, 28);
    ctx.fillRect(43, 26, 5, 28);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 26, 5, 28);
    ctx.strokeRect(43, 26, 5, 28);

    // Vortex d'extraction tourbillonnant entre les deux piliers
    const vRadius = 15 + Math.sin(frame * Math.PI) * 1.5;
    const vortexGrad = ctx.createRadialGradient(32, 34, 2, 32, 34, vRadius);
    vortexGrad.addColorStop(0, '#ffffff');
    vortexGrad.addColorStop(0.25, '#38bdf8');
    vortexGrad.addColorStop(0.65, '#0284c7');
    vortexGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');

    ctx.fillStyle = vortexGrad;
    ctx.beginPath();
    ctx.ellipse(32, 34, vRadius, vRadius * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rayons / tourbillons d'énergie ascendante
    ctx.fillStyle = '#e0f2fe';
    const angleOffset = (frame * Math.PI) / 2;
    for (let i = 0; i < 4; i++) {
      const a = angleOffset + (i * Math.PI) / 2;
      const rx = 32 + Math.cos(a) * (8 + pulse);
      const ry = 34 + Math.sin(a) * (11 + pulse);
      ctx.fillRect(Math.round(rx - 1), Math.round(ry - 1), 2, 2);
    }

    // Faisceau de lumière céleste s'élevant vers la voûte
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.fillRect(29, 2, 6, 32);

    return canvas;
  }
}
