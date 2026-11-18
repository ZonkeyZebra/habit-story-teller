// Cloudflare Worker: verifies Google sign-in, stores per-user data in KV, proxies Anthropic.
// The Anthropic key exists ONLY as a Worker secret (ANTHROPIC_API_KEY).
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...h } });

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return J({ error: 'Forbidden origin' }, 403, cors);
    const u = await verify(req, env);
    if (!u) return J({ error: 'Unauthorized' }, 401, cors);
    const path = new URL(req.url).pathname;
    try {
      if (path === '/api/data') {
        const key = 'u:' + u.sub;
        if (req.method === 'GET') return J({ data: JSON.parse((await env.DATA.get(key)) || 'null') }, 200, cors);
        if (req.method === 'PUT') {
          const body = await req.text();
          if (new TextEncoder().encode(body).length > 500000) return J({ error: 'Storage limit reached (500 KB)' }, 413, cors); // keep in sync with js/config.js
          await env.DATA.put(key, body); return J({ ok: 1 }, 200, cors);
        }
      }
      if (path === '/api/story' && req.method === 'POST') {
        const rk = `r:${u.sub}:${new Date().toISOString().slice(0, 10)}`, n = +((await env.DATA.get(rk)) || 0);
        if (n >= +env.DAILY_LIMIT) return J({ error: 'Daily story limit reached' }, 429, cors);
        const { system, prompt } = await req.json();
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: env.MODEL, max_tokens: 900, system: String(system).slice(0, 3000), messages: [{ role: 'user', content: String(prompt).slice(0, 12000) }] })
        });
        if (!r.ok) return J({ error: 'Story service error' }, 502, cors);
        await env.DATA.put(rk, String(n + 1), { expirationTtl: 172800 });
        return J({ text: (await r.json()).content?.[0]?.text || '' }, 200, cors);
      }
    } catch { return J({ error: 'Server error' }, 500, cors); }
    return J({ error: 'Not found' }, 404, cors);
  }
};

async function verify(req, env) {
  const t = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!t) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t));
  if (!r.ok) return null;
  const p = await r.json();
  if (p.aud !== env.GOOGLE_CLIENT_ID || p.email_verified !== 'true' || +p.exp * 1000 < Date.now()) return null;
  const allow = (env.ALLOWED_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (allow.length && !allow.includes(p.email.toLowerCase())) return null;
  return p;
}
