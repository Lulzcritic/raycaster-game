import packageInfo from '../../package.json';

/**
 * Résolution dynamique de la version de l'application :
 * - Injectée automatiquement lors du build / déploiement Docker (VITE_APP_VERSION)
 * - Ou repli sur la version de package.json en environnement local / test
 */
export const APP_VERSION: string =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_VERSION)
    ? String(import.meta.env.VITE_APP_VERSION)
    : (packageInfo.version || '0.1.1');

export const APP_TITLE_WITH_VERSION: string = `The old citadel • alpha v${APP_VERSION}`;
