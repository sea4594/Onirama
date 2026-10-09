# Onirama deployment — GitHub Pages + free Firebase

The **current recommended deployment** is **GitHub Pages (frontend) + Firebase Spark (anonymous auth and Firestore)**. There is no Render setup, persistent Node server, or player login requirement. See the complete one-time [Firebase setup and multiplayer code checklist](FIREBASE_MULTIPLAYER.md).

The historical Phase 9–11 Render/Node approach has been superseded for production use. `server/index.js` remains in the repository for optional local tests and backward compatibility; do not set `ONIRAMA_API_ORIGIN` for the Firebase Pages deployment.

**Release:** Push `main` through the guarded hotfix; use the preconfigured Firebase browser settings; rerun **GitHub Pages (solo + Firebase multiplayer)**. Then verify room creation, two distinct anonymous seats, lobby ready/start, draft, decisions and reload on two devices.
