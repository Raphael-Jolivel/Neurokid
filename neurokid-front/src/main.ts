import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './app/environments/environment';

/**
 * On charge /config.json AVANT de démarrer Angular pour pouvoir
 * surcharger `environment.apiUrl` à la volée. Le fichier est généré
 * par nginx au démarrage du conteneur à partir de la variable
 * d'environnement `API_URL` (cf. docker-entrypoint.sh).
 *
 * En cas d'absence de config.json (ex. `ng serve` local), on garde
 * la valeur par défaut codée dans environment.ts.
 */
fetch('/config.json', { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null))
  .then(cfg => {
    if (cfg && typeof cfg.apiUrl === 'string' && cfg.apiUrl.length > 0) {
      environment.apiUrl = cfg.apiUrl;
    }
  })
  .catch(() => { /* pas de config.json : on garde la valeur par défaut */ })
  .finally(() => {
    bootstrapApplication(App, appConfig)
      .catch((err) => console.error(err));
  });
