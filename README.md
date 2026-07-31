# Training Calculator — Web App

Quasar (Vue 3 + Vite) companion to the Training Calculator Android app.
Logs in against the backup server (contract v3), mirrors the app's data
(history, moves, templates), adds a statistics dashboard, and hosts the
admin panel for user management.

The webapp is a **sync client**: it holds the full sync document in a Pinia
store, stamps `updated_at` on every edit, records tombstones for deletions,
and pushes the whole document to `POST /api/sync` (debounced ~2 s; the header
chip shows Pending/Syncing/Synced and forces a push on click). Web and phone
edits converge by the server's last-write-wins merge.

## Development

```bash
npm install
npm run dev          # http://localhost:9000, /api proxied to https://localhost:8443
```

Run the backend first (see `../training-calculator-backup/RUNBOOK.md`).
The dev proxy accepts the mkcert certificate (`secure: false`).

## Tests

```bash
npm test             # Vitest: dataset store LWW stamping, tombstones, debounce
```

## Production build & deploy

```bash
npm run build
rm -rf ../training-calculator-backup/webapp-dist/*
cp -r dist/* ../training-calculator-backup/webapp-dist/
```

The Go server serves the build at `https://<host>:8443/` with SPA fallback.
Browsers must trust the mkcert CA (`$(mkcert -CAROOT)/rootCA.pem`) — or a
real certificate when deployed on the internet (see the backend runbook).
