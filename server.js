'use strict';

// edgetools-bizdev — single small web service.
//
//   • public surface  (open)   : /, /intake/*, /styles.css   → public/
//   • gated surface   (staff)  : /staff/*, /internal/*        → internal/
//
// The gate is a single shared STAFF_PASSWORD. Everything else — the session
// cookie, route protection, redirects — is independent of how a user proves
// who they are: replacing the marked LOGIN block with an OAuth handshake that
// sets the same session cookie changes nothing else. Same routes, same cookie,
// same service, same domain.

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.set('trust proxy', true); // DO App Platform terminates TLS and forwards.

const PORT = process.env.PORT || 8080;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-change-me';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const COOKIE = 'bizdev_staff';

app.use(express.urlencoded({ extended: false }));

// ---- session helpers ----
function sign(b64) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
}
function issueSession(req, res, user) {
  const payload = { u: user, exp: Date.now() + SESSION_TTL_MS };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${b64}.${sign(b64)}`;
  const secure = req.secure ? ' Secure;' : ''; // set Secure only over HTTPS
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}
function getSession(req) {
  const jar = (req.headers.cookie || '').split(';').map((s) => s.trim());
  const raw = jar.find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [b64, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!b64 || !sig) return null;
  const expected = sign(b64);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
function requireStaff(req, res, next) {
  if (getSession(req)) return next();
  return res.redirect('/login');
}

// ---- public surface (open) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- LOGIN (swap this block to change how a user authenticates) ----
app.get('/login', (req, res) => res.type('html').send(loginPage()));
app.post('/login', (req, res) => {
  const given = Buffer.from(req.body.password || '');
  const want = Buffer.from(STAFF_PASSWORD);
  const ok = STAFF_PASSWORD.length > 0 &&
    given.length === want.length &&
    crypto.timingSafeEqual(given, want);
  if (!ok) return res.status(401).type('html').send(loginPage('Incorrect password.'));
  issueSession(req, res, 'staff'); // any future auth flow calls this same helper
  res.redirect('/staff/');
});
// ---- end LOGIN block ----

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect('/');
});

// ---- gated surface (staff only) ----
app.use('/staff', requireStaff, express.static(path.join(__dirname, 'internal')));
app.use('/internal', requireStaff, express.static(path.join(__dirname, 'internal')));

app.listen(PORT, () => console.log(`edgetools-bizdev listening on :${PORT}`));

function loginPage(error) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>Staff login · Edge BizDev</title>
<link rel="stylesheet" href="/styles.css"></head><body>
<main class="shell"><header class="brand">
<a href="/" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:10px;">
<span class="mark">◆</span><span class="wordmark">Edge <b>BizDev</b></span></a></header>
<section class="hero"><h1>Staff login</h1>
<p class="lede">Internal tools. Access restricted to Edge staff.</p>
${error ? `<p style="color:#ff6b6b;margin:-16px 0 20px;">${error}</p>` : ''}
<form method="POST" action="/login" style="display:flex;gap:12px;flex-wrap:wrap;max-width:420px;">
<input type="password" name="password" placeholder="Staff password" autofocus required
 style="flex:1;min-width:220px;padding:12px 16px;border-radius:10px;border:1px solid var(--edge);background:var(--panel);color:var(--text);font-size:15px;">
<button type="submit" class="btn btn-primary">Sign in</button></form>
<div class="cta-row" style="margin-top:20px;"><a class="btn btn-ghost" href="/">&larr; Back</a></div>
</section><footer class="foot"><span>Edge · internal tools</span>
<span class="muted">Gated surface.</span></footer></main></body></html>`;
}
