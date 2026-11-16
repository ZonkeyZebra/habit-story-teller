// Bootstrap, auth gate, and event handling.
import { init, state, save } from './store.js';
import { initAuth } from './auth.js';
import { render, ui } from './ui.js';
import { uid, today, ending, score } from './engine.js';
import { nextBeat } from './story.js';
let view = 'today', busy = false;
const $ = s => document.querySelector(s);
const draw = () => { $('#view').innerHTML = render(view); document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view)); };
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(() => t.className = '', 4000); };
const login = () => { $('#app').hidden = true; $('#login').hidden = false; };
async function start() { $('#login').hidden = true; try { await init(); } catch { return login(); } $('#app').hidden = false; draw(); }

async function beat(kind) {
  if (busy) return; busy = true; toast('Writing...');
  try {
    const c = state.campaign, r = await nextBeat(state, state.tasks.filter(t => state.pending.includes(t.id)), kind);
    c.beats.push(r.beat); c.summary = r.summary; c.collected.push(...r.collected); c.chaos = r.chaos; state.pending = [];
    if (kind === 'finale') c.ending = ending(score(state).ratio);
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
  restart() { if (!confirm('End this campaign and start a new one?')) return; state.campaign = null; state.done = {}; state.pending = []; save(); draw(); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-view]'); if (!el) return;
  if (el.dataset.view) { view = el.dataset.view; ui.editing = null; draw(); }
  else if (el.type !== 'checkbox') acts[el.dataset.act]?.(el);
});
document.addEventListener('change', e => { if (e.target.dataset.act === 'toggle') acts.toggle(e.target); });
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = new FormData(f);
  if (f.id === 'taskform') {
    const t = { id: f.dataset.id || uid(), name: d.get('name').trim(), freq: d.get('freq'), days: d.getAll('d').map(Number), every: +d.get('every') || 1, points: +d.get('points'), active: true };
    const i = state.tasks.findIndex(x => x.id === t.id); i < 0 ? state.tasks.push(t) : state.tasks[i] = t; ui.editing = null;
  }
  if (f.id === 'campform') {
    state.campaign = { hero: d.get('hero'), genre: d.get('genre'), notes: d.get('notes'), length: +d.get('length'), start: today(), beats: [], summary: '', collected: [], chaos: 10, ending: null };
    state.done = {}; state.pending = [];
  }
  save(); draw();
});
window.addEventListener('reauth', login);
const wait = () => window.google?.accounts?.id ? (initAuth(start), sessionStorage.getItem('idt') && start()) : setTimeout(wait, 100);
wait();
