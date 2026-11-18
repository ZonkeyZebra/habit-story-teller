// Bootstrap, auth gate, and event handling.
import { init, state, save, storage } from './store.js';
import { hasToken, clearToken } from './api.js';
import { render, ui } from './ui.js';
import { uid, today, ending, score } from './engine.js';
import { nextBeat } from './story.js';
import { download, slug, storyMarkdown } from './export.js';
let busy = false;
const VIEWS = ['today', 'habits', 'story', 'summary', 'past'];
const cur = () => VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
const $ = s => document.querySelector(s);
const draw = () => { const v = cur(); $('#view').innerHTML = render(v); document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.hash === '#' + v)); banner(); };
let saveKind = 'ok';
function banner() {
  const s = storage(); let msg = '';
  if (saveKind === 'full') msg = 'Storage is full, so your latest changes are saved only in this browser. <a href="#past">Export or delete old campaigns</a> to free up space.';
  else if (saveKind === 'error') msg = 'Could not save to your account. Your latest changes are kept in this browser and will be retried on your next change.';
  else if (s.pct >= 80) msg = `Storage is ${s.pct}% full. <a href="#past">Export or delete old campaigns</a> before it fills up.`;
  $('#banner').hidden = !msg; $('#banner').innerHTML = msg;
}
window.addEventListener('savestate', e => { saveKind = e.detail; banner(); });
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(() => t.className = '', 4000); };
const login = () => { clearToken(); location.replace('login.html'); };
async function start() { try { await init(); } catch { return login(); } $('#app').hidden = false; draw(); }

function archive(c, status) {
  c.id ||= uid();
  if (state.history.some(h => h.id === c.id)) return;
  state.history.unshift({ ...c, final: score(state), status, endedOn: today() });
}
async function beat(kind) {
  if (busy) return; busy = true; toast('Writing...');
  try {
    const c = state.campaign, r = await nextBeat(state, state.tasks.filter(t => state.pending.includes(t.id)), kind);
    c.beats.push(r.beat); c.summary = r.summary; c.collected.push(...r.collected); c.chaos = r.chaos; state.pending = [];
    if (kind === 'finale') { c.ending = ending(score(state).ratio); archive(c, 'completed'); }
    save(); toast('New story beat added');
  } catch (e) { toast(e.auth ? 'Session expired. Sign in again.' : 'Could not write the beat: ' + e.message); if (e.auth) login(); }
  busy = false; draw();
}
const acts = {
  toggle(el) { const d = today(), a = state.done[d] || (state.done[d] = []), id = el.dataset.id, i = a.indexOf(id);
    if (i < 0) { a.push(id); state.pending.push(id); } else { a.splice(i, 1); state.pending = state.pending.filter(x => x !== id); }
    save(); draw(); },
  beat: () => beat('beat'), finale: () => beat('finale'),
  edit(el) { ui.editing = el.dataset.id; draw(); }, new() { ui.editing = 'new'; draw(); }, cancel() { ui.editing = null; draw(); },
  del(el) { if (!confirm('Delete this habit?')) return; state.tasks = state.tasks.filter(t => t.id !== el.dataset.id); save(); draw(); },
  full() { ui.full = !ui.full; draw(); },
  open(el) { ui.viewing = el.dataset.id; ui.full = false; draw(); },
  back() { ui.viewing = null; draw(); },
  rmpast(el) { if (!confirm('Delete this past campaign for good? Export it first if you want a copy.')) return; state.history = state.history.filter(h => h.id !== el.dataset.id); ui.viewing = null; save(); draw(); },
  export(el) { const h = state.history.find(x => x.id === el.dataset.id); if (h) download(`${slug(h.hero)}-${h.start}.md`, storyMarkdown(h), 'text/markdown'); },
  exportall() { download('habit-story-past-campaigns.json', JSON.stringify(state.history, null, 2), 'application/json'); },
  signout() { localStorage.removeItem('hst'); localStorage.removeItem('hst_dirty'); login(); },
  restart() { if (!confirm('End this campaign and start a new one? It will be saved under Past.')) return; const c = state.campaign; if (c.beats.length) archive(c, c.ending ? 'completed' : 'abandoned'); state.campaign = null; state.done = {}; state.pending = []; save(); draw(); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.type !== 'checkbox') acts[el.dataset.act]?.(el);
});
document.addEventListener('change', e => { if (e.target.dataset.act === 'toggle') acts.toggle(e.target); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.act !== 'chaos' || !state.campaign || state.campaign.ending) return;
  const value = Number(el.value);
  if (!Number.isInteger(value) || value < 0 || value > 100) return;
  state.campaign.chaos = value;
  $('#chaos-value').value = value;
  const gauge = $('.gauge');
  gauge.setAttribute('aria-label', `Chaos ${value} of 100`);
  gauge.querySelector('.val').style.strokeDasharray = `${value} 100`;
  gauge.querySelector('text').textContent = value;
  save();
});
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = new FormData(f);
  if (f.id === 'taskform') {
    const t = { id: f.dataset.id || uid(), name: d.get('name').trim(), freq: d.get('freq'), days: d.getAll('d').map(Number), every: +d.get('every') || 1, points: +d.get('points'), active: true };
    if (t.freq === 'days' && !t.days.length) return toast('Pick at least one day');
    const i = state.tasks.findIndex(x => x.id === t.id); i < 0 ? state.tasks.push(t) : state.tasks[i] = t; ui.editing = null;
  }
  if (f.id === 'campform') {
    state.campaign = { id: uid(), hero: d.get('hero'), genre: d.get('genre'), notes: d.get('notes'), length: +d.get('length'), start: today(), beats: [], summary: '', collected: [], chaos: 10, ending: null };
    state.done = {}; state.pending = [];
  }
  save(); draw();
});
window.addEventListener('reauth', login);
window.addEventListener('hashchange', () => { ui.editing = null; ui.viewing = null; draw(); });
hasToken() ? start() : login();
