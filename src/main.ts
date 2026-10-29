import { Game } from './core/Game';
import { LoadingScreen } from './ui/LoadingScreen';

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error("Élément canvas '#screen' introuvable dans le DOM.");
}

const loadingScreen = LoadingScreen.getInstance();
loadingScreen.setProgress(5, 'Initialisation des registres de la Citadelle...');

const game = new Game(canvas);

await game.init((progress, message) => {
  loadingScreen.setProgress(progress, message);
});

await loadingScreen.finish();

game.start();