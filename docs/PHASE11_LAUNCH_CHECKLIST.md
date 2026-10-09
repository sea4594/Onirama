# Onirama launch checklist — updated Firebase multiplayer plan

The paid Node/Render deployment instructions from Phase 11 are superseded. Follow [FIREBASE_MULTIPLAYER.md](FIREBASE_MULTIPLAYER.md): free Firebase Spark project, Anonymous Authentication, Firestore production database with `firestore.rules`, GitHub Actions Firebase web-app variables, and Pages redeploy.

Check that a second player joins via 8-digit hexadecimal code or link from a separate browser profile/device; both can ready/start/draft, see correct masked hand, use expansion decisions, and reconnect on reload. Check room reads/writes and permissions in Firebase console. The active team game state is stored in Firestore; there is no separately running server or code service. Complete actual browser/cloud smoke tests before public launch.
