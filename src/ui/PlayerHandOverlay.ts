import handwandUrl from '../assets/textures/handwand.png';
import type { Player } from '../entities/Player';
import type { Renderer } from '../graphics/Renderer';

/**
 * Calque haute résolution pour l'affichage de la main et de la baguette du joueur.
 * Rendu à la résolution native de l'écran (anti-aliasé et parfaitement net, non-pixelisé)
 * avec une échelle agrandie et réactive selon le ratio d'affichage.
 */
export class PlayerHandOverlay {
  private readonly container: HTMLElement | null;
  private readonly handImg: HTMLImageElement | null;
  private isVisible = true;

  constructor() {
    this.container = document.getElementById('player-hand-container');
    this.handImg = document.getElementById('player-hand-image') as HTMLImageElement | null;
    if (this.handImg) {
      this.handImg.src = handwandUrl;
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

    // Taille agrandie ("plus grosse") : 74% de la hauteur de la vue de jeu 4:3
    const handSize = Math.round(rect.height * 0.74);
    this.handImg.style.width = `${handSize}px`;
    this.handImg.style.height = `${handSize}px`;

    // Échelle des mouvements de balancement (bobbing)
    const scaleX = rect.width / 320;
    const scaleY = rect.height / 240;

    // Recul lors de l'incantation d'une boule de feu
    const casting = player.isCasting();
    const castOffsetX = casting ? -8 * scaleX : 0;
    const castOffsetY = casting ? -12 * scaleY : 0;

    // Positionnement au premier plan en bas à droite, orienté vers le centre
    const baseX = rect.left + rect.width * 0.90 - handSize;
    const baseY = rect.top + rect.height - handSize + (rect.height * 0.04);

    const x = Math.round(baseX + player.handBobX * scaleX + castOffsetX);
    const y = Math.round(baseY + player.handBobY * scaleY + castOffsetY);

    this.handImg.style.left = `${x}px`;
    this.handImg.style.top = `${y}px`;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.container && !visible) {
      this.container.style.display = 'none';
    }
  }
}
