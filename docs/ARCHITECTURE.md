# edgetools-bizdev — architecture

An umbrella site for Edge BizDev tools, covering **partner intake** and
**partner vetting**. Two ends of one pipeline: an outside partner rep applies
(intake) → our team reviews them (vetting).

## Surfaces & trust tiers

One small Node service (`server.js`) serves both surfaces:

| Surface | Routes | Who | Auth |
|---|---|---|---|
| Public | `/`, `/intake/*`, `/styles.css` (`public/`) | Outside partner reps | None |
| Gated | `/staff/*`, `/internal/*` (`internal/`) | Edge staff only | Login required |

**Non-negotiable:** internal content is served *from behind* auth, never shipped
in the public bundle. The service only serves `internal/` after a valid session
cookie. See `internal/README.md`.

## Auth

The gated surface uses a shared staff password (`STAFF_PASSWORD`). The service
compares it in constant time, issues an HMAC-signed session cookie, and gates
`/staff` and `/internal`.

The login flow is isolated to the two marked LOGIN blocks in `server.js`, and
every session goes through a single `issueSession()` helper. The password check
can therefore be swapped for an identity provider without touching routing,
cookie handling, or deploy config.

A shared password gives no per-person identity. Use it for a staff preview, not
for real partner assessments.

## Deploy model

- **Repo → GitHub → App Platform**, auto-deploy on push to `main`.
- CI holds a scoped DO token in **repo secrets** — no standing DO credential on
  any operator's machine. Risk is gated by repo write access and branch
  protection.
- Backend logic (form submission handling, notifications, scoring) belongs in
  the serverless functions repo with its own isolated env block, not here.

## Layout

```
public/            world-readable static site
  index.html       landing
  styles.css       shared styling
  intake/          partner intake form
internal/          auth-gated surface — never public
.do/               App Platform specs
docs/              this file
```
