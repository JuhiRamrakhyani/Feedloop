# FeedLoop

**Free, open-source feedback forms.** Build a custom form, send the link to
anyone — by phone number, name, or ID — and review every response on a clean
dashboard.

No paid survey SaaS, no per-response fees, no external identity API. Everything
runs on your own Node.js + PostgreSQL.

---

## Features

- **Custom templates** — build forms with rating, radio, checkbox, text,
  textarea, and number questions, with required flags and options.
- **Send to anyone** — pick a contact from your directory, or just type any name
  and phone number. No need to import data first.
- **Pluggable delivery** — send via the built-in free/open-source WhatsApp
  provider (Baileys), a generic HTTP webhook (WAHA, Evolution API, Twilio,
  Zapier, n8n…), or console-only logging.
- **Secure links** — the URL carries only a 96-bit random token; nothing about
  the recipient. Single-use and expiry enforced server-side.
- **Dashboard + review** — forms sent, completed, awaiting, response rate,
  templates, questions, recipients contacted, and full answer drill-down.
- **Multi-color themes** — 8 accent colors plus light/dark mode, a top-navbar
  layout, and a subtle animated background (gradient orbs, dot grid, particles).
  Saved per browser.
- **Zero-config demo** — `npm run seed` loads dummy contacts, templates, and
  requests so every screen has data on first run.

---

## Quick start

```bash
git clone https://github.com/your-username/feedloop.git
cd feedloop
npm install
cp .env.example .env        # set PG_* (Postgres must be running)
npm run migrate             # create tables
npm run seed                # load demo contacts + templates + requests
npm start                   # http://localhost:3000
```

Open **http://localhost:3000/index.html** for the admin app
(Dashboard · Templates · Send · Review).

By default `DELIVERY_PROVIDER=log`, so sending a form prints the message to your
server console and shows the link in the UI — perfect for trying it out. Switch
providers when you're ready (below).

### Test a send from the CLI

```bash
npm run send:test -- 9876543210          # or any number, with country code if needed
npm run send:test -- 9876543210 "Priya Sharma"
```

This creates a real request, delivers it through your configured
`DELIVERY_PROVIDER` (logged by default), and prints the feedback link to open.

---

## Sending to anyone

The Send tab has two modes:

1. **Directory** — search the seeded `identities` table by name or ID and pick a
   contact.
2. **Enter manually** — type a name and phone number (company/city optional) and
   send immediately. Nothing is saved to your directory; the recipient is
   snapshotted onto the request.

Both modes hit the same endpoint:

```http
POST /api/feedback/send
Content-Type: application/json

# From your directory:
{ "identityId": 4821, "templateId": 1, "mobileNumber": "+919839000001" }

# Ad-hoc (any number, no directory row):
{ "name": "Priya Sharma", "mobileNumber": "+919876543210", "templateId": 1 }
```

---

## Delivery providers

Set `DELIVERY_PROVIDER` in `.env`. The interface is one call — adding your own
provider is a single small file in `src/services/delivery/`.

| Provider  | Free | Setup | Best for |
|-----------|------|-------|----------|
| `log`     | ✅   | none  | local dev, demos, CI |
| `webhook` | ✅   | set `WEBHOOK_URL` | plugging in any sender you already run |
| `baileys` | ✅   | `npm run whatsapp:login` once | real WhatsApp sends with no API key |

### `log` (default)

Prints the message to the server console. Great for development.

### `webhook`

POSTs JSON to any URL you control:

```json
{ "to": "+919876543210", "phone": "919876543210", "name": "Priya Sharma",
  "link": "https://your-host/feedback/abc123", "message": "Hi Priya Sharma, ..." }
```

```env
DELIVERY_PROVIDER=webhook
WEBHOOK_URL=https://your-gateway.example.com/send
WEBHOOK_TOKEN=optional-bearer-token
```

Use it with **WAHA**, **Evolution API**, a **Baileys microservice**, **Twilio**,
**Zapier**, **n8n** — anything that accepts a JSON body.

### `baileys` (free, open-source WhatsApp)

[Baileys](https://github.com/WhiskeySockets/Baileys) is an open-source WhatsApp
Web client. Pair once:

```bash
npm run whatsapp:login      # scan the QR: WhatsApp → Linked devices
# then in .env:
DELIVERY_PROVIDER=baileys
```

The session is stored in `BAILEYS_AUTH_DIR` (default `.baileys_auth`, gitignored)
and reused on every restart. `baileys` and `qrcode-terminal` ship as optional
dependencies — if they were skipped, install them with
`npm install baileys qrcode-terminal`.

> Baileys is **unofficial**. Use a dedicated number, warm it up, and avoid
> unsolicited bulk messaging — WhatsApp can ban numbers that abuse it.

---

## Which WhatsApp API is best?

There is no single winner — it depends on budget, scale, and how much you care
about being "official". Recommendations from most practical to most official:

1. **Baileys (built in)** — *best free/open-source option*.
   No API key, no monthly fee, works with your own number. At your own risk
   (unofficial; can be rate-limited or banned). Ideal for personal projects,
   small businesses, and self-hosting.

2. **WAHA / Evolution API** — *best self-hosted, API-friendly option*.
   Open-source HTTP servers that wrap WhatsApp (WAHA uses Baileys/webjs;
   Evolution API wraps Baileys). They expose a clean REST API + webhooks, so you
   point this app's `webhook` provider at them and get retries, a UI, and
   multi-number support. Best when you want Baileys' cost but with an HTTP
   service and dashboard.

3. **WhatsApp Cloud API (Meta)** — *best official option*.
   The sanctioned Meta API with a free tier (service conversations) and a
   generous per-message pricing model above it. No ban risk, verified business
   sender, templates for messaging outside the 24-hour window. Requires a Meta
   Business account and phone number. Recommended the moment this is for a real
   business.

4. **Twilio / 360dialog / Infobip / MessageBird** — *best managed commercial
   option*. They resell the official API with SLAs, dashboards, and support. Pay
   per message; least operational burden.

**Rule of thumb:** start with **Baileys** (this repo) or **WAHA** for free; move
to the **official WhatsApp Cloud API** when reliability, deliverability, and
compliance matter. Whichever you pick, this app talks to all of them through the
`webhook` provider.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_NAME` | `FeedLoop` | Name shown in the UI |
| `PORT` | `3000` | HTTP port |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Base of the feedback link |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | localhost / 5432 / postgres / postgres / feedloop | PostgreSQL connection |
| `LINK_SECRET` | dev value | Change in production |
| `LINK_EXPIRY` | `14d` | `14d`, `7d`, `2h`, `30m`, `90s` |
| `LINK_TOKEN_BYTES` | `12` | Token entropy (12 = 96-bit) |
| `DELIVERY_PROVIDER` | `log` | `log` \| `webhook` \| `baileys` |
| `WEBHOOK_URL` / `WEBHOOK_TOKEN` / `WEBHOOK_TIMEOUT` | – / – / `15000` | Webhook provider |
| `BAILEYS_AUTH_DIR` | `.baileys_auth` | WhatsApp session folder |
| `BAILEYS_CONNECT_TIMEOUT` | `60000` | Wait for WhatsApp to connect |
| `WHATSAPP_COUNTRY_CODE` | `91` | Prefix added to bare numbers |
| `URL_SHORTENER` | `off` | `tinyurl` \| `isgd` \| `off` |

---

## Build a template

Templates tab → **Create template** → name it, then add questions. Question
types: rating, radio, checkbox, text, textarea, number. Set options for
radio/checkbox and mark fields required. Editing or deleting a template is safe:
deletion is a hard delete when unused, or a deactivation when responses already
exist.

---

## Security model

- The link contains **only** a short random token (96-bit entropy) that is the
  `request_uuid` — never the recipient's name, ID, or number.
- Editing the token makes the database lookup fail → `410 This link is invalid.`
- Expiry is enforced by `feedback_requests.expires_at` on every public request.
- Submission is **single-use**: once completed, further submits return `409`.
- All validation is re-checked **server-side** in `src/routes/public.routes.js`.
- `helmet` sets `Referrer-Policy: no-referrer` so the token never leaks to
  third-party resources.
- Public endpoints are rate-limited.

---

## Project structure

```
src/
  config/       postgres.js                 — the single DB connection
  services/     identityService.js          — directory search (PostgreSQL)
                feedbackService.js          — templates, requests, answers
                tokenService.js             — short opaque link tokens
                shortenService.js           — optional URL shortening
                delivery/                   — pluggable senders
                  index.js                  — provider selection
                  log.js | webhook.js | baileys.js
  routes/       identity / template / feedback / public / review
  scripts/      whatsapp-login.js           — Baileys QR pairing
  db/           schema.sql, seed.sql, migrate.js, seed.js
public/         index.html + review.html + form.html, js/, css/theme.css
```

---

## Deploying

- Point `PUBLIC_BASE_URL` at a public HTTPS domain (the recipient must reach it).
- Set a strong `LINK_SECRET`.
- Use a managed PostgreSQL, and run `npm run migrate` once.
- Pick a production `DELIVERY_PROVIDER` (official WhatsApp Cloud API via webhook,
  or a self-hosted WAHA/Evolution instance).
- Put the admin app behind authentication before exposing it publicly (it can
  create templates and send messages).

---

## Contributing

Issues and pull requests are welcome. Please keep providers isolated in
`src/services/delivery/` and avoid adding external runtime dependencies to the
core (delivery extras belong in `optionalDependencies`).

## License

[MIT](LICENSE)
