# Ballroom Online Final

Approved online version based on the final offline demo.

## Before uploading

1. Copy your **existing working Firebase values** into `firebase-config.js`.
2. In Firebase Authentication, enable **Anonymous** sign-in.
3. Deploy `database.rules.json` to Realtime Database.
4. Upload every file in this folder to the root of your GitHub Pages repository.
5. Keep the page URLs with the same room query, for example `?room=main-ballroom`.

Do not overwrite a working Firebase config with placeholder values.

## Pages

- `index.html` — Admin
- `display.html` — Public display/search
- `checkin.html` — iPad QR check-in
- `summary.html` — Summary, CSV, Google Sheet sync
- `tickets.html` — 10-ticket A4 printing

## Backups

- Every reset/import/restore creates a cloud snapshot first.
- Export JSON regularly and keep it in Google Drive.
- Reset is protected by masked PIN entry. PIN: `1800`.

## Google Sheet sync

1. Open the target Sheet.
2. Extensions → Apps Script.
3. Paste `apps-script/Code.gs`.
4. Deploy as Web app, execute as yourself, access: anyone with link.
5. Put the deployment URL in `google-sheet-config.js`.

Target Sheet ID is already set to:
`1-JhDg21Kd1H63KbqnYXXzp3RWot7PkTU4Vecnlc-TB8`

## Camera requirements

Camera scanning requires HTTPS. GitHub Pages provides HTTPS. On iPad, allow camera permission when prompted.
