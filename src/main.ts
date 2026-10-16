import { Game } from './core/Game';

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error("Élément canvas '#screen' introuvable dans le DOM.");
}

const game = new Game(canvas);

await game.init();

game.start();