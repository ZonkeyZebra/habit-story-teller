// Bootstrap, auth gate, and event handling.
import { init, state, save, storage } from './store.js';
import { hasToken, clearToken } from './api.js';
import { render, ui, esc } from './ui.js';
import { uid, today, ending, score, dayNumber } from './engine.js';
import { nextBeat } from './story.js';
import { download, slug, storyMarkdown } from './export.js';
import { icon } from './icons.js';
import { sceneId } from './scenes.js';
let busy = false;
const VIEWS = ['today', 'habits', 'story', 'summary', 'past', 'settings'];
const cur = () => VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
const $ = s => document.querySelector(s);
const applyScene = () => { document.body.dataset.scene = sceneId(state); };
const draw = () => { const v = cur(); $('#view').innerHTML = render(v); document.querySelectorAll('#nav a').forEach(a => { const on = a.hash === '#' + v; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); }); applyScene(); banner(); };
let saveKind = 'ok';
function banner() {
  const s = storage(); let msg = '';
  if (saveKind === 'full') msg = 'Storage is full, so your latest changes are saved only in this browser. <a href="#past">Export or delete old campaigns</a> to free up space.';
  else if (saveKind === 'error') msg = 'Could not save to your account. Your latest changes are kept in this browser and will be retried on your next change.';
  else if (s.pct >= 80) msg = `Storage is ${s.pct}% full. <a href="#past">Export or delete old campaigns</a> before it fills up.`;
  $('#banner').hidden = !msg; $('#banner').innerHTML = msg;
}
window.addEventListener('savestate', e => { saveKind = e.detail; banner(); });
let toastTimer;
const toast = m => { const t = $('#toast'); clearTimeout(toastTimer); t.textContent = m; t.className = 'show'; toastTimer = setTimeout(() => t.className = '', 4000); };

// Item-found pop-up: one per story beat, lists every item the beat's tasks earned.
// It closes by itself, pauses while pointed at or focused (so it can be read), and can be closed any time.
let foundTimer, foundStart = 0, foundLeft = 0, foundPaused = false;
const hideFound = () => { clearTimeout(foundTimer); $('#found').className = ''; };
const runFound = () => { foundPaused = false; foundStart = Date.now(); clearTimeout(foundTimer); foundTimer = setTimeout(hideFound, foundLeft); const b = $('#found .found-timer i'); if (b) b.style.animationPlayState = 'running'; };
const pauseFound = () => { if (foundPaused || $('#found').className !== 'show') return; foundPaused = true; clearTimeout(foundTimer); foundLeft -= Date.now() - foundStart; const b = $('#found .found-timer i'); if (b) b.style.animationPlayState = 'paused'; };
function showFound(items) {
  if (!items?.length || !state.settings.popups) return;
  const secs = state.settings.popupSecs || 6, el = $('#found');
  el.innerHTML = `<div class="found-box"><div class="found-head"><b>${items.length > 1 ? 'Items found!' : 'Item found!'}</b><button type="button" class="x" data-act="closefound" aria-label="Close item pop-up">&times;</button></div>
  <ul>${items.map(i => `<li><span class="slot">${icon(i.icon, 40)}</span><span><b>${esc(i.name)}</b><small>for completing ${esc(i.task)}</small></span></li>`).join('')}</ul>
  <div class="found-timer" aria-hidden="true"><i style="animation-duration:${secs}s"></i></div></div>`;
  el.className = 'show'; foundLeft = secs * 1000; runFound();
}
const holdFound = e => e.type === 'pointerenter' || e.type === 'focusin' ? pauseFound() : (foundPaused && runFound());
['pointerenter', 'pointerleave', 'focusin', 'focusout'].forEach(t => $('#found').addEventListener(t, holdFound));

const login = () => { clearToken(); location.replace('login.html'); };
async function start() {
  try { await init(); } catch { return login(); }
  document.querySelectorAll('#nav [data-icon]').forEach(a => a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon, 22)));
  $('#app').hidden = false; draw();
}

function archive(c, status) {
  c.id ||= uid();
  if (state.history.some(h => h.id === c.id)) return;
  state.history.unshift({ ...c, final: score(state), status, endedOn: today() });
}
async function beat(kind) {
  if (busy) return; busy = true; toast('Writing...');
  let found = null;
  try {
    const c = state.campaign, r = await nextBeat(state, state.tasks.filter(t => state.pending.includes(t.id)), kind);
    c.beats.push(r.beat); c.summary = r.summary; c.collected.push(...r.collected); c.chaos = r.chaos; state.pending = [];
    if (kind === 'finale') { c.ending = ending(score(state).ratio); archive(c, 'completed'); }
    save(); toast('New story beat added'); found = r.beat.items;
  } catch (e) { toast(e.auth ? 'Session expired. Sign in again.' : 'Could not write the beat: ' + e.message); if (e.auth) login(); }
  busy = false; draw(); showFound(found);
}
// Settings fields that change the running campaign. Invalid input is put back and explained (error prevention).
function storyField(el) {
  const c = state.campaign; if (!c || c.ending) return;
  const k = el.name, v = el.value.trim();
  if (k === 'length') {
    const n = Number(v), min = Math.max(3, dayNumber(c));
    if (!Number.isInteger(n) || n < min || n > 90) { el.value = c.length; return toast(`Length must be a whole number from ${min} to 90 days`); }
    c.length = n;
  } else if (k === 'notes') c.notes = v;
  else { if (!v) { el.value = c[k]; return toast('This field cannot be empty'); } c[k] = v; }
  save(); toast('Saved');
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
  closefound: hideFound,
  signout() { localStorage.removeItem('hst'); localStorage.removeItem('hst_dirty'); login(); },
  restart() { if (!confirm('End this campaign and start a new one? It will be saved under Past.')) return; const c = state.campaign; if (c.beats.length) archive(c, c.ending ? 'completed' : 'abandoned'); state.campaign = null; state.done = {}; state.pending = []; save(); draw(); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.type !== 'checkbox' && el.type !== 'radio' && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') acts[el.dataset.act]?.(el);
});
document.addEventListener('change', e => {
  const el = e.target, a = el.dataset.act;
  if (a === 'toggle') return acts.toggle(el);
  if (a === 'scene') { state.settings.scene = el.value; applyScene(); save(); toast('Scene changed'); }
  else if (a === 'popups') { state.settings.popups = el.checked; save(); if (!el.checked) hideFound(); draw(); toast(el.checked ? 'Item pop-ups on' : 'Item pop-ups off'); }
  else if (a === 'popupsecs') { state.settings.popupSecs = Number(el.value); save(); toast(`Pop-ups stay ${el.value} seconds`); }
  else if (a === 'story') storyField(el);
  else if (a === 'chaos') toast('Chaos saved');
});
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
window.addEventListener('hashchange', () => { ui.editing = null; ui.viewing = null; draw(); window.scrollTo(0, 0); });
hasToken() ? start() : login();
