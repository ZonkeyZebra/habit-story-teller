// Cloudflare Worker: Google sign-in once, then its own 30-day session token; per-user data in KV; Anthropic proxy.
// Secrets (never in the repo): ANTHROPIC_API_KEY, SESSION_SECRET, ALLOWED_EMAILS.
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
const MAX_BYTES = 500000; // keep in sync with STORAGE_LIMIT_BYTES in js/config.js
const SESSION_DAYS = 30;
const DENY = { expired: 'Session expired', notallowed: 'This Google account has not been invited yet', invalid: 'Unauthorized' };
const deny = (code, cors) => J({ error: DENY[code] || DENY.invalid, code }, 401, cors);

export default {
  async fetch(req, env) {
    // ALLOWED_ORIGIN may be one origin or a comma-separated list; matching ignores letter case.
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const ok = allowed.includes(origin.toLowerCase());
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || ''), 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!ok) return J({ error: 'Forbidden origin' }, 403, cors);
    try {
      if (!env.SESSION_SECRET) return J({ error: 'Server is missing its session secret' }, 500, cors);
      const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const path = new URL(req.url).pathname;

      // Sign-in: trade a Google ID token for our own session token.
      if (path === '/api/session' && req.method === 'POST') {
        const g = await verifyGoogle(token, env);
        if (g.code) return deny(g.code, cors);
        return J({ token: await issue(g.user, env), days: SESSION_DAYS }, 200, cors);
      }

      // Everything else needs a valid session token.
      const s = await verifySession(token, env);
      if (s.code) return deny(s.code, cors);
      const u = s.user;

      if (path === '/api/data') {
        const key = 'u:' + u.sub;
        if (req.method === 'GET') return J({ data: JSON.parse((await env.DATA.get(key)) || 'null') }, 200, cors);
        if (req.method === 'PUT') {
          const body = await req.text();
          if (new TextEncoder().encode(body).length > MAX_BYTES) return J({ error: 'Storage limit reached (500 KB)' }, 413, cors);
          await env.DATA.put(key, body); return J({ ok: 1 }, 200, cors);
        }
      }
      if (path === '/api/story' && req.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) return J({ error: 'Server is missing its Anthropic key' }, 500, cors);
        const rk = `r:${u.sub}:${new Date().toISOString().slice(0, 10)}`, n = +((await env.DATA.get(rk)) || 0);
        if (n >= +env.DAILY_LIMIT) return J({ error: 'Daily story limit reached' }, 429, cors);
        const { system, prompt } = await req.json();
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: env.MODEL, max_tokens: 1500, system: String(system).slice(0, 3000), messages: [{ role: 'user', content: String(prompt).slice(0, 12000) }] })
        });
        if (!r.ok) { console.error('Anthropic', r.status, (await r.text()).slice(0, 300)); return J({ error: `Story service error (${r.status})` }, 502, cors); }
        await env.DATA.put(rk, String(n + 1), { expirationTtl: 172800 });
        const d = await r.json();
        const text = Array.isArray(d.content)
          ? d.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n')
          : '';
        return J({ text, stop: d.stop_reason }, 200, cors);
      }
      return J({ error: 'Not found' }, 404, cors);
    } catch (e) { console.error(e); return J({ error: 'Server error' }, 500, cors); }
  }
};

// ---- Sessions: "hs1.<payload>.<signature>", payload = {sub, email, exp}, signed with HMAC-SHA256 ----
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hmacKey = env => crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
// The email allowlist is rechecked on every request, so removing someone takes effect right away.
const permitted = (env, email) => {
  const list = (env.ALLOWED_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return !list.length || list.includes(String(email).toLowerCase());
};

async function issue(user, env) {
  const payload = b64u(enc.encode(JSON.stringify({ sub: user.sub, email: user.email, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload));
  return `hs1.${payload}.${b64u(sig)}`;
}

async function verifySession(token, env) {
  try {
    const [tag, payload, sig] = token.split('.');
    if (tag !== 'hs1' || !payload || !sig) return { code: 'invalid' };
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(env), unb64u(sig), enc.encode(payload)))) return { code: 'invalid' };
    const p = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    if (!p.sub || p.exp * 1000 < Date.now()) return { code: 'expired' };
    if (!permitted(env, p.email)) return { code: 'notallowed' };
    return { user: p };
  } catch { return { code: 'invalid' }; }
}

// Google ID token -> { user } or { code }. Used only when signing in.
async function verifyGoogle(token, env) {
  if (!token) return { code: 'invalid' };
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
  if (!r.ok) return { code: 'expired' };
  const p = await r.json();
  if (p.aud !== env.GOOGLE_CLIENT_ID || p.email_verified !== 'true') return { code: 'invalid' };
  if (+p.exp * 1000 < Date.now()) return { code: 'expired' };
  if (!permitted(env, p.email)) return { code: 'notallowed' };
  return { user: { sub: p.sub, email: p.email } };
}
