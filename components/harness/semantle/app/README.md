# Korean Semantle

Run `npm start` or `npm run dev` for the shared live app at http://127.0.0.1:4175. Moa opens this same server in its project pane and reuses it if already running. The app serves source files directly and reloads on file save, including backend dependency changes. Set MOA_SEMANTLE_PORT or SIMILARITY_SERVICE_URL as needed. No new dependencies. `npm run build` produces a static dist/ for deployment/checks only; never edit dist/ directly.

Daily data comes from the official `/today`, `/top_scores/:id`, and `/guess/:id/:word` APIs. `daily.js` validates the current puzzle. Both standalone and Moa use this project's `server.mjs` and the exact same browser files; Moa has no separate game API, copied UI, or puzzle selection. `bridge.js` is retained for historical tests but is not used by Moa.

Refresh at Korean midnight, every 30 seconds, and on focus/visibility restoration. Each action checks the Korean date. Old in-flight scores are discarded on rollover. Failures preserve records, block stale play, and retry. Scores are never fabricated or copied from yesterday.

Progress is saved under `kkomantle-puzzle-ID-v2` and preferences under `kkomantle-settings`. Existing 1693 records are retained. Current and previous puzzle lists have spoiler warnings. Historical routes fetch the requested puzzle. `puzzle.js` is historical regression data, not the active daily puzzle.

For Craft static previews, the build writes `dist/daily-snapshot.json`, valid only on that Korean calendar day. It expires at midnight. Persistent daily operation requires `npm start` or the embedded Next app: upstream CORS rules prevent live API access from static-only hosting.

`npm test` checks midnight boundaries, daily API responses, separate puzzle histories, settings retention, discarding an in-flight old score at midnight, server actions, preview expiry, invalid inputs, and outages. `tests/browser_check.py` is an optional Playwright check against the running standalone server.

Credits: original Korean Semantle / Newsjelly, David Turner Semantle. Design and assets follow the supplied captures. Daily answers and scores depend on https://semantle-ko.newsjel.ly/.
