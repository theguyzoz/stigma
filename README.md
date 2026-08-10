# Stigma

> Stigma is a plant part, and so is your account: small, useful, in bloom.
> A Google-like account layer with apps, profile management, a developer console, an OAuth provider, an AI API, mobile-money billing, and a self-hosted JSON database that auto-backups to your Google Drive.

## Quick start

```bash
cd stigma
npm install
cp .env.example .env   # then edit
npm start              # http://localhost:3000
```

That's it. There is no build step.

## What you get

### Account flow (the spec)

1. `GET /` — if no confirmed account, redirects to `/accounts?redirect=/dashboard`.
2. `/accounts` — if not signed in, shows the sign-in form; if signed in, shows **your existing accounts** (like Google's chooser) plus two big options: **Use another account** → `/accounts/signin`, **Create an account** → `/accounts/create`.
3. Sign-up / sign-in form asks for first name, last name, phone and a strong password. On success it bounces back to `/accounts?redirect=...`.
4. Clicking an existing account hits `GET /accounts/confirm/:id?redirect=...`, which sets a 30-day active-account cookie and redirects to your destination. Subsequent visits go straight to the dashboard.
5. The dashboard has the requested tiles: **Open Apps**, **Manage Profile**, **Developers** (+ a list of your other accounts).
6. `GET /signout` clears both cookies and returns to `/accounts`.

### Apps (`/apps`)

Thirteen free, open-source, already-hosted tools rendered inside an iframe, with a "Open in new tab" button:

- Live Radio, Weather Forecast, Live TV, Maps, Translator, Calculator, Notes, PDF Reader, Whiteboard, Code Playground, RSS Reader, Paint Studio, Sound Library.

You can self-host any of these and swap the URL in `lib/apps.js`.

### Manage Profile (`/profile`)

- First / last name
- Display name
- Phone number
- Secondary email (also exposed as the OAuth `email` scope)
- Account ID is shown at the bottom for support

### Developers (`/developers`)

- One-click **Enable developer account** on top of your current Stigma account.
- **OAuth API** — full `authorization_code` flow with consent screen, `client_id` / `client_secret`, and ready-to-paste **browser SDK** (`/static/js/stigma.js`) and **Node SDK example** (the snippet on the OAuth page). Scopes returned by `/oauth/userinfo`: `sub`, `name`, `given_name`, `family_name`, `email`, `phone`.
- **AI API** — `POST /api/ai/chat`, 5,000 messages/day and 25 RPM on the free tier; configurable model name; upgrades via Paynow.
- **Billing** — three plans (Starter free / Pro $5 / Business $20) with **Ecocash**, **OneMoney** and **Innbucks** mobile-money checkout powered by Paynow.

### Google Drive auto-backup

`data/db.json` is the database. Every write marks it dirty; once it has been quiet for ~30 minutes, a snapshot is uploaded to your Drive as `stigma-db-YYYY-MM-DD.json` (same-day snapshots are updated, not duplicated).

To turn it on, visit:

```
https://your-stigma-host/drive-setup?secret=YOUR_SESSION_SECRET
```

Paste a Google Cloud service-account JSON (with the Drive File scope) and an optional Drive folder ID. The first backup runs immediately.

You can also force a backup:

```
curl -X POST 'https://your-stigma-host/api/backup?secret=YOUR_SESSION_SECRET'
```

### AI provider

The AI proxy reads its config from `ai/gpt.js` (a CommonJS file). The version that ships is wired to the GPT-4O proxy you supplied; it supports two template shapes:

**A. OpenAI-compatible** — `module.exports = { baseUrl, apiKey, model, toBody? }`. We POST `${baseUrl}/chat/completions` and forward the response. Good for OpenAI, OpenRouter, Together, local llama.cpp with an OpenAI shim, etc.

**B. Custom** — `module.exports = { chat: async ({ messages }) => any }`. The hook is fully in charge of the upstream call. Use this when the URL or response format isn't OpenAI-shaped. The current `ai/gpt.js` uses this form because the DeepEnglish proxy has its own envelope.

Example (OpenAI):
```js
module.exports = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey:  process.env.OPENAI_API_KEY,
  model:   'gpt-4o-mini'
};
```

Example (local llama.cpp):
```js
module.exports = {
  baseUrl: 'http://127.0.0.1:8080/v1',
  apiKey:  'no-key-needed',
  model:   'llama-3.1-8b'
};
```

While the file is missing or empty, the API returns a friendly stub response so the rest of the system keeps working.

## File map

```
stigma/
├── server.js                 # express app + routes
├── package.json
├── .env.example              # copy to .env
├── data/db.json              # auto-created JSON database
├── ai/gpt.js                 # AI provider template (paste your gpt.js here)
├── lib/
│   ├── db.js                 # JSON DB, atomic writes, rate counters
│   ├── session.js            # signed cookies
│   ├── brand.js              # inline CSS + inline-SVG logo
│   ├── errors.js             # "No pollens found" error pages
│   ├── apps.js               # 13 free apps
│   ├── drive.js              # Drive auto-backup
│   ├── paynow.js             # Ecocash / OneMoney / Innbucks
│   ├── ai.js                 # AI proxy
│   └── oauth.js              # placeholder for helpers
├── public/
│   ├── img/favicon.svg
│   └── js/stigma.js          # browser SDK for third-party apps
├── scripts/install.sh
└── views/                    # one HTML template per route
```

## Deploying

1. `git clone` this folder onto your server.
2. `npm install --production`.
3. `cp .env.example .env`, then set `PORT`, `PUBLIC_URL` and `SESSION_SECRET` (long random).
4. `PAYNOW_INTEGRATION_ID` / `PAYNOW_INTEGRATION_KEY` come from your Paynow dashboard.
5. Put your `ai/gpt.js` in place.
6. `pm2 start server.js --name stigma` (or any other process manager).
7. Front it with nginx / Caddy / Cloudflare. Make sure the host forwards `/oauth/*` and `/static/*`.
8. Visit `/drive-setup?secret=$SESSION_SECRET` once and paste a service account JSON.

## Tone of voice

Errors are short, plant-themed and professional. The two staples are:

- **"No pollens found."** — for empty / not-found states.
- **"Something went wrong with another."** — for unexpected failures, followed by a friendly follow-up.

The favicon, the OAuth consent screen, the dashboard and the developer console all share the same white background, green accent (`#2f8a4f`), rounded corners, and inline-SVG stigma-petal logo.
