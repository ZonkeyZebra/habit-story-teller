// App state: cached in localStorage, synced to the Worker (debounced) with failure reporting.
import { loadData, saveData } from './api.js';
import { CONFIG } from './config.js';
const blank = () => ({ tasks: [], campaign: null, done: {}, pending: [], history: [], settings: { scene: 'city', popups: true, popupSecs: 6 } });
// Fill in any setting an older saved copy does not have yet.
const norm = s => { const b = blank(); return { ...b, ...s, settings: { ...b.settings, ...(s?.settings || {}) } }; };
export let state = blank();
let timer;
const bytes = o => new Blob([JSON.stringify(o)]).size;
const say = detail => window.dispatchEvent(new CustomEvent('savestate', { detail }));

// Usage numbers for the storage meter and warnings.
export function storage() {
  const used = bytes(state), limit = CONFIG.STORAGE_LIMIT_BYTES, h = state.history;
  const avg = h.length ? h.reduce((n, x) => n + bytes(x), 0) / h.length : 22000;
  return { used, limit, avg, measured: h.length > 0, pct: Math.min(100, Math.round(used / limit * 100)), room: Math.max(0, Math.floor((limit - used) / avg)) };
}
export async function init() {
  const local = () => norm(JSON.parse(localStorage.getItem('hst') || '{}'));
  if (localStorage.getItem('hst_dirty')) { state = local(); save(); return; } // unsynced changes win over the cloud copy
  try { state = norm((await loadData()).data || {}); localStorage.setItem('hst', JSON.stringify(state)); }
  catch (e) { if (e.auth) throw e; state = local(); }
}
export function save() {
  localStorage.setItem('hst', JSON.stringify(state));
  localStorage.setItem('hst_dirty', '1');
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (bytes(state) > CONFIG.STORAGE_LIMIT_BYTES) return say('full');
    try { await saveData(state); localStorage.removeItem('hst_dirty'); say('ok'); }
    catch (e) { if (e.auth) window.dispatchEvent(new Event('reauth')); else say(/limit|large/i.test(e.message) ? 'full' : 'error'); }
  }, 800);
}
