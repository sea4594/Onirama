# Deployment — GitHub Pages / live Onirama

Onirama now builds a GitHub Pages static **solo** edition at https://sea4594.github.io/Onirama/ using `.github/workflows/pages.yml`. Unlike previous releases, the artifact includes the standalone JS engine and uses relative URLs. Solo saves are local to the browser. No login or server is needed for solo play.

**GitHub setup (once):** Repository > Settings > Pages > Build and deployment > Source **GitHub Actions**. The workflow runs the full release gate before deploying. Actions must have appropriate permissions. Deployment only occurs after the Phase 6 hotfix is committed/pushed.

**Multiplayer:** GitHub Pages cannot run the Node.js game server, persistent sessions or SSE. Those endpoints are still provided by `npm start` and need a separate Node.js hosting target, production persistent storage and a secure API origin; multiplayer is intentionally shown as unavailable on the Pages-only edition. Do not add an unsecured browser-side room-code implementation. Hosting a production multiplayer service is in Phase 9.
