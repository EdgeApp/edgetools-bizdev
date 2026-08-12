# edgetools-bizdev

Umbrella site for Edge BizDev tools.

- **Public:** landing page + partner **intake** form (`public/`).
- **Staff-only:** partner **vetting** and other internal tools (`internal/`),
  served behind a login.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design, trust tiers,
and deploy model.

## Run locally

```bash
npm install
cp .env.example .env   # set STAFF_PASSWORD + SESSION_SECRET
npm start              # http://localhost:8080
```

Public pages are open; `/staff/` redirects to `/login` until you sign in.

## Deploy modes

- **Static site** — `.do/app.static.yaml`. Serves `public/` only: landing and
  intake, no running process and no login.
- **Node service** — `.do/app.service.yaml`. Serves both surfaces and enables
  the gated `/staff` area.
