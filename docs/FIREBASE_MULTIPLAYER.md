# GitHub Pages + Firebase multiplayer (free-tier, no separate Node host)

This matches the hosting model in the supplied BibleGuessr checkpoint: a static GitHub Pages site, Firebase anonymous browser authentication, and Firestore transactions with realtime snapshots. Onirama does **not** require a paid Render instance, a dedicated Node server, user registration, Google login, or manual room-code provisioning.

## Setup (once)

1. Open https://console.firebase.google.com/ and create a **separate Onirama project** on the **Spark (no-cost)** plan. Creating a separate project avoids overwriting BibleGuessr's Firestore rules or sharing quota and rooms. Google Analytics is optional and not used by Onirama.
2. In Firebase **Build → Authentication → Sign-in method**, enable **Anonymous**. Under Authentication → Settings → Authorized domains, add `sea4594.github.io` if it is not already present. Users will never see a sign-in form. Their local browser receives a persistent anonymous Firebase UID.
3. In Firebase **Build → Firestore Database**, create the default database (choose an available region and **Production mode**). Open its **Rules** tab, paste the entire contents of the repository's [`firestore.rules`](../firestore.rules), and click **Publish**. Do not use open/test-mode rules. If you reuse an existing Firebase project, merge these rules into its existing policy rather than replacing it; a separate project is safer.
4. The repository already contains your exact Firebase Web app configuration in `public/runtime-config.js` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). **You do not need to create or rename GitHub Actions variables.** These six values identify a public browser app; they are not administrator credentials. Firebase security is enforced through Authentication and Firestore Rules. Never commit a Firebase service-account key.
5. **Remove `ONIRAMA_API_ORIGIN`** if you set it previously; it is unnecessary. Ensure GitHub **Settings → Pages → Build and deployment → Source** is **GitHub Actions**. The hotfix push will trigger the Pages workflow; if necessary manually rerun **Actions → GitHub Pages (solo + Firebase multiplayer)**. Load https://sea4594.github.io/Onirama/ and try **Settings → Test multiplayer connection**.

## Verify rooms / codes

1. In Onirama Settings choose **Test multiplayer connection**. This verifies the browser can load the SDK and establish anonymous Firebase auth; it does **not** establish that every Firestore rule is correct.
2. Browser A: Multiplayer → Online. Enter a display name, create a lobby, select expansions/difficulties, and share the four-letter code or invitation link.
3. Browser B: Online → Join. Enter a display name and the four-letter code, or open the invitation link **on a different device or separate browser profile/private window**. The guest can view the shared expansion setup but only the host can edit it. Two tabs within the same browser profile share an anonymous Firebase UID and therefore occupy the same seat, not two seats.
4. Both choose Ready; the host presses Start game. Each drafts three cards. Check separate hands, shared cards, expansion decision dialogs, the explicit End turn button, and reconnection after refresh. The host can end the lobby for both players.
5. Confirm Firestore → Data contains `oniramaRooms/<CODE>` and that the room's `version` increases for accepted actions. Reload either tab. Test an incorrect code, third browser and simultaneous actions: these must not displace a member or override a version conflict.

Room codes are randomly generated in the browser using `crypto.getRandomValues`, allocated transactionally, and checked for collisions. New lobbies use four uppercase letters; legacy eight-character hexadecimal invitations are still supported. Firebase keeps the room document; there is **no separate code service**. Open rooms cannot accept new players after 30 days. Existing members can resume while their anonymous browser identity is retained. Clearing browser storage may lose that seat permanently.

## Hot seat and rules deployments

The Multiplayer → Hot seat tab runs two-player cooperative play locally on one device, with two display-name fields and the same expansions and difficulty options. No Firebase connection is required. The pass-device screen hides the next player's private hand during draft and between turns; the active player confirms they are ready before their view is revealed. Completed turns wait for the End turn button.

**After installing a hotfix that changes `firestore.rules`:** the GitHub Pages push does not update Firebase security rules. Open **Firebase Console → onirama-5124e → Firestore Database → Rules**, paste the current repository `firestore.rules`, and **Publish**. Otherwise online lobby setup changes can be rejected even after the release gate and Pages deployment pass. The local release gate cannot verify live Firestore permissions.

## Limits and security

- Firebase Spark Firestore currently offers 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day and 10 GiB/month outbound transfer; free-tier availability and limits are controlled by Firebase and can change. At the limit, operations may stop rather than bill you; monitor Firebase → Usage.
- Firestore Security Rules restrict stored rooms to their two anonymous Firebase UIDs after joining; code lookup is allowed while a lobby has an open seat. Collection-wide listings and deletes are denied.
- **Trust model:** BibleGuessr's browser-driven approach relies on cooperative clients. Onirama runs the deterministic engine inside each player's browser and commits its outcome with a Firestore transaction. Firestore rules can enforce room membership and the active seat, **but cannot recompute every card rule**. Both members can inspect the complete serialized game state in developer tools (even though the interface hides the other hand and deck). This is suitable for friendly, trusted two-player play, **not tamper-proof tournaments or cryptographically private hands**. Strong secrecy/anti-cheating would require a trusted execution environment or server and a different design.
- Firebase web SDK files are loaded from Google's official `gstatic.com` CDN when multiplayer is used; solo play does not depend on Firebase. Browser network access and storage must be allowed.
- Firestore documents have a maximum size and transactions can be rejected on contention; action/version conflicts are surfaced and must be retried from the refreshed state. Apps using the Spark plan should avoid excessive automated play or malicious room creation.
- Anonymous Firebase authentication creates a technical anonymous identity stored in the browser, **not** a visible account/profile/login feature. No personal details are required.

## Troubleshooting

- **Multiplayer not configured:** Confirm the Pages deployment completed and that deployed `runtime-config.js` contains `onirama-5124e`; this file is generated from `public/runtime-config.js` and should not be edited on the live site.
- **`auth/operation-not-allowed`:** Enable Anonymous sign-in for the correct Firebase project.
- **`permission-denied` when creating a room:** Confirm that you published the complete repository `firestore.rules` in **onirama-5124e → Firestore Database → (default) → Rules**, and enabled Anonymous Authentication. The v0.12.3 client creates a room directly instead of requesting permission to read a document that does not yet exist. Pushing a GitHub hotfix does **not** publish Firestore security rules. For existing room actions, also check the anonymous UID and that the room has a free seat.
- **Connection blocked / dynamic import failed:** Ensure gstatic.com and Firebase domains are reachable. Check network/ad-blocker settings.
- **Invite opens but second player is treated as host:** Use another browser profile, private window or device; same browser profile shares one anonymous UID.
- **Room disappeared after clearing storage:** The local anonymous UID was lost. Firebase prevents another UID from taking over a claimed seat; create a new room.
- **Old Render backend variable:** Remove `ONIRAMA_API_ORIGIN`; no Node server is necessary on Pages.

For any change to the Firestore rules, repeat the two-device smoke test. The repository's automated gate validates the engine, UI and pure room-state transitions but **does not execute against a live Firebase project or Firestore emulator**; live Firebase permissions and browser flows must be verified after setup.
