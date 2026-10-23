import handwandUrl from '../assets/textures/handwand.png';
import homonculusUrl from '../assets/textures/homonculus.png';
import type { Player } from '../entities/Player';
import type { Renderer } from '../graphics/Renderer';

/**
 * Calque haute résolution pour l'affichage de la main et de la baguette du joueur,
 * ainsi que de l'Homonculus tenu en main gauche lorsque équipé.
 * Rendu à la résolution native de l'écran (anti-aliasé et parfaitement net, non-pixelisé)
 * avec une échelle agrandie et réactive selon le ratio d'affichage.
 */
export class PlayerHandOverlay {
  private readonly container: HTMLElement | null;
  private readonly handImg: HTMLImageElement | null;
  private readonly leftHandImg: HTMLImageElement | null;
  private isVisible = true;

  constructor() {
    this.container = document.getElementById('player-hand-container');
    this.handImg = document.getElementById('player-hand-image') as HTMLImageElement | null;
    this.leftHandImg = document.getElementById('player-left-hand-image') as HTMLImageElement | null;

    if (this.handImg) {
      this.handImg.src = handwandUrl;
    }
    if (this.leftHandImg) {
      this.leftHandImg.src = homonculusUrl;
    }
  }

  public update(player: Player, renderer: Renderer, isExtracted: boolean): void {
    if (!this.container || !this.handImg) {
      return;
    }

    // Masqué si le joueur est mort, s'est extrait ou si le calque est désactivé (menu pause)
    if (!player.isAlive() || isExtracted || !this.isVisible) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    const canvas = renderer.getCanvas();
    const rect = canvas.getBoundingClientRect();

    // Échelle des mouvements de balancement (bobbing)
    const scaleX = rect.width / 320;
    const scaleY = rect.height / 240;
    const casting = player.isCasting();

    // =========================================================================
    // 1. MAIN DROITE (BAGUETTE MAGIQUE)
    // =========================================================================
    const handSize = Math.round(rect.height * 0.78);
    this.handImg.style.width = `${handSize}px`;
    this.handImg.style.height = `${handSize}px`;

    const castOffsetX = casting ? -8 * scaleX : 0;
    const castOffsetY = casting ? -12 * scaleY : 0;

    const baseX = rect.left + rect.width * 0.90 - handSize;
    const baseY = rect.top + rect.height - handSize + Math.round(rect.height * 0.13);

    const x = Math.round(baseX + player.handBobX * scaleX + castOffsetX);
    const y = Math.round(baseY + player.handBobY * scaleY + castOffsetY);

    this.handImg.style.left = `${x}px`;
    this.handImg.style.top = `${y}px`;

    // =========================================================================
    // 2. MAIN GAUCHE (HOMONCULUS ÉQUIPÉ)
    // =========================================================================
    if (this.leftHandImg) {
      const offhandItem = player.inventory.getItem('offhand');
      const hasHomonculus = offhandItem?.id === 'offhand_homonculus';

      if (!hasHomonculus) {
        this.leftHandImg.style.display = 'none';
      } else {
        this.leftHandImg.style.display = 'block';

        // Homonculus taille : deux fois moins gros (38% de la hauteur au lieu de 76%)
        const leftSize = Math.round(rect.height * 0.38);
        this.leftHandImg.style.width = `${leftSize}px`;
        this.leftHandImg.style.height = `${leftSize}px`;

        // Respiration organique vivante de la créature
        const nowSec = performance.now() * 0.003;
        const breatheY = Math.sin(nowSec * 2.2) * (2 * scaleY);
        const breatheX = Math.cos(nowSec * 1.5) * (1 * scaleX);

        // Réaction au lancer de sort
        const leftCastOffsetY = casting ? 4 * scaleY : 0;

        // Positionnement en bas à gauche de la vue (sous l'UI)
        const baseLeftX = rect.left + Math.round(rect.width * 0.06) - Math.round(leftSize * 0.35);
        const baseLeftY = rect.top + rect.height - leftSize + Math.round(rect.height * 0.05);

        // Balancement asymétrique naturel
        const leftBobX = -player.handBobX * scaleX * 0.5;
        const leftBobY = player.handBobY * scaleY * 0.5;

        const lx = Math.round(baseLeftX + leftBobX + breatheX);
        const ly = Math.round(baseLeftY + leftBobY + breatheY + leftCastOffsetY);

        this.leftHandImg.style.left = `${lx}px`;
        this.leftHandImg.style.top = `${ly}px`;
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.container && !visible) {
      this.container.style.display = 'none';
    }
  }
}
