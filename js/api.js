// All network calls go through the Cloudflare Worker.
// Sign-in trades a Google ID token for the Worker's own 30-day session token, kept in localStorage.
import { CONFIG } from './config.js';
const KEY = 'hst_session';
let token = localStorage.getItem(KEY) || '';
sessionStorage.removeItem('idt'); // old storage for the one-hour Google token
export const setToken = t => { token = t; localStorage.setItem(KEY, t); };
export const hasToken = () => !!token;
export const clearToken = () => { token = ''; localStorage.removeItem(KEY); };

// Called from the login page. Throws an Error whose .code is 'notallowed', 'expired', 'network' or 'error'.
export async function signInWithGoogle(credential) {
  let r;
  try { r = await fetch(CONFIG.WORKER_URL + '/api/session', { method: 'POST', headers: { Authorization: 'Bearer ' + credential } }); }
  catch { throw Object.assign(new Error('Cannot reach the server'), { code: 'network' }); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || 'Sign-in failed'), { code: body.code || 'error' });
  setToken(body.token);
}

async function call(path, opts = {}) {
  let r;
  try { r = await fetch(CONFIG.WORKER_URL + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }); }
  catch { throw new Error('Cannot reach the story server (check the Worker URL and its allowed origin)'); }
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error(body.error || 'Session expired'), { auth: true, code: body.code || 'expired' });
  if (!r.ok) throw new Error(body.error || 'Request failed');
  return body;
}
export const loadData = () => call('/api/data');
export const saveData = d => call('/api/data', { method: 'PUT', body: JSON.stringify(d) });
export const generate = (system, prompt) => call('/api/story', { method: 'POST', body: JSON.stringify({ system, prompt }) });
