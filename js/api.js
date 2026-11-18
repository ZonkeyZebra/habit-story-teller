// All network calls go through the Cloudflare Worker.
import { CONFIG } from './config.js';
let token = sessionStorage.getItem('idt') || '';
export const setToken = t => { token = t; sessionStorage.setItem('idt', t); };
export const hasToken = () => !!token;
export const clearToken = () => { token = ''; sessionStorage.removeItem('idt'); };
async function call(path, opts = {}) {
  let r;
  try { r = await fetch(CONFIG.WORKER_URL + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }); }
  catch { throw new Error('Cannot reach the story server (check the Worker URL and its allowed origin)'); }
  if (r.status === 401) throw Object.assign(new Error('Session expired'), { auth: true });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Request failed');
  return r.json();
}
export const loadData = () => call('/api/data');
export const saveData = d => call('/api/data', { method: 'PUT', body: JSON.stringify(d) });
export const generate = (system, prompt) => call('/api/story', { method: 'POST', body: JSON.stringify({ system, prompt }) });
