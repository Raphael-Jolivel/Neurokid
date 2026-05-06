/**
 * Configuration runtime de l'application.
 *
 * `apiUrl` est écrasée au démarrage par `main.ts` à partir du fichier
 * `/config.json` servi par nginx. Cela permet de bâtir l'image Docker
 * une seule fois et de la déployer sur N environnements (dev, labo,
 * prod) en passant simplement la variable `API_URL` au conteneur.
 *
 * En `ng serve` local (sans config.json), c'est la valeur par défaut
 * ci-dessous qui sert.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000'
};
