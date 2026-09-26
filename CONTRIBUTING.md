# Contributing to FeedLoop

Thanks for helping improve FeedLoop! 🎉

## Setup

1. Fork the repo and clone your fork
2. `npm install`
3. `cp .env.example .env` and set your `PG_*` values (PostgreSQL must be running)
4. `npm run migrate && npm run seed && npm start`
5. Open http://localhost:3000/index.html

## Guidelines

- Keep each delivery provider isolated in `src/services/delivery/` (one file per
  provider). New providers are a single `send()` export.
- Keep heavy or unofficial senders (`baileys`, `qrcode-terminal`, …) in
  `optionalDependencies`, never in `dependencies`.
- Match the existing style: CommonJS, 2-space indent, no new runtime deps for the
  core.
- Never commit secrets. `.env` is gitignored — use `.env.example` for new options.

## Testing before a PR

Please verify the full flow:

1. `npm run seed` then `npm start`
2. Send a form (Directory or Enter manually)
3. Open the generated link, submit it
4. Confirm it appears under Review, and a second submit is rejected

Syntax-check your changes:

```bash
find src public/js -name '*.js' -print0 | xargs -0 -n1 node --check
```

## Pull requests

Describe what changed, link any issue, and note which `DELIVERY_PROVIDER` you
tested with. Keep PRs focused and small where possible.
