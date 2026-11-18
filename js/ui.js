// Views: pure functions returning HTML strings.
import { state, storage } from './store.js';
import { isDue, today, dayNumber, score, ending } from './engine.js';
export const ui = { editing: null, full: false, viewing: null };
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const empty = (h, p) => `<h2>${h}</h2><p class="muted">${p}</p>`;
const gauge = m => `<svg class="gauge" viewBox="0 0 100 56" role="img" aria-label="Chaos ${m} of 100"><path class="trk" d="M10 50A40 40 0 0 1 90 50" pathLength="100"/><path class="val" d="M10 50A40 40 0 0 1 90 50" pathLength="100" style="stroke-dasharray:${m} 100"/><text x="50" y="48" text-anchor="middle">${m}</text></svg>`;
const beatHtml = b => `<article class="beat"><h3>Day ${b.day}: ${esc(b.highlight)}</h3>${b.twist ? '<span class="twist">Chaos twist (rolled ' + b.roll + ')</span>' : ''}${b.text.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</article>`;

function today_() {
  const c = state.campaign; if (!c) return empty('No campaign yet', 'Start one in the Story tab.');
  const d = today(), due = state.tasks.filter(t => isDue(t, d, c.start)), done = state.done[d] || [];
  return `<h2>Day ${dayNumber(c)} of ${c.length}</h2><div class="meter">${gauge(c.chaos)}<span class="muted">Chaos meter</span></div>
  <ul class="tasks">${due.map(t => `<li><label><input type="checkbox" data-act="toggle" data-id="${t.id}" ${done.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span><b>${t.points}</b></label></li>`).join('') || '<li class="muted">Nothing due today.</li>'}</ul>
  ${c.ending ? '<p class="muted">This campaign has ended. See the Summary.</p>' : `<button class="primary" data-act="beat" ${state.pending.length ? '' : 'disabled'}>Tell the next beat (${state.pending.length})</button>`}`;
}
function form(t) {
  const x = t || { name: '', freq: 'daily', days: [1, 2, 3, 4, 5], every: 2, points: 3 };
  return `<form id="taskform" class="card" data-id="${t?.id || ''}"><input name="name" placeholder="Habit or task" value="${esc(x.name)}" required aria-label="Name">
  <select name="freq" aria-label="Frequency">${[['daily', 'Every day'], ['days', 'Certain weekdays'], ['every', 'Every N days']].map(([v, l]) => `<option value="${v}" ${x.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
  <div class="row">${DAYS.map((n, i) => `<label class="chip"><input type="checkbox" name="d" value="${i}" ${x.days.includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div>
  <label>Every <input name="every" type="number" min="1" max="30" value="${x.every}" style="width:80px"> days (for "Every N days")</label>
  <label>Effort: <output id="pv">${x.points}</output>/5 <input name="points" type="range" min="1" max="5" value="${x.points}" oninput="pv.value=this.value"></label>
  <button class="primary">${t ? 'Save changes' : 'Add habit'}</button> <button type="button" class="link" data-act="cancel">Cancel</button></form>`;
}
function habits() {
  const e = ui.editing;
  return `<h2>Habits</h2>${e ? form(state.tasks.find(t => t.id === e)) : '<button class="primary" data-act="new">Add a habit</button>'}
  <ul class="tasks">${state.tasks.map(t => `<li><label style="cursor:default"><span>${esc(t.name)}<br><small class="muted">${t.freq === 'daily' ? 'Daily' : t.freq === 'days' ? t.days.map(i => DAYS[i]).join(' ') : 'Every ' + t.every + ' days'}</small></span><b>${t.points}</b><button class="link" data-act="edit" data-id="${t.id}">Edit</button><button class="link" data-act="del" data-id="${t.id}">Delete</button></label></li>`).join('')}</ul>
  ${state.campaign ? '<p class="muted">Edits recalculate your score for the whole campaign.</p>' : ''}`;
}
function story() {
  const c = state.campaign;
  if (!c) return `<h2>Start a story</h2><form id="campform" class="card"><input name="hero" placeholder="Main character (name and a line about them)" required><input name="genre" placeholder="Genre and tone (e.g. cozy fantasy)" required><textarea name="notes" rows="3" placeholder="Anything you want in the story (places, side characters, themes)"></textarea><label>Length in days <input name="length" type="number" min="3" max="90" value="14" style="width:90px"></label><button class="primary">Begin campaign</button></form>`;
  return `<h2>${esc(c.hero)}</h2>${c.beats.map(beatHtml).join('') || '<p class="muted">Complete habits on Today, then tell your first beat.</p>'}
  ${!c.ending && dayNumber(c) >= c.length ? `<button class="primary" data-act="finale">Write the finale</button>` : ''}`;
}
function summary() {
  const c = state.campaign; if (!c) return empty('Summary', 'Nothing yet. Start a campaign first.');
  const sc = score(state), pct = Math.round(sc.ratio * 100);
  return `<h2>Summary</h2><div class="card">${pct}% of effort points earned (${sc.got}/${sc.max}). ${c.ending ? `Ending: <b>${c.ending}</b>.` : `Heading toward a <b>${ending(sc.ratio)}</b> ending.`}</div>
  <h3>Highlights</h3><ul>${c.beats.map(b => `<li>Day ${b.day}: ${esc(b.highlight)}</li>`).join('') || '<li class="muted">None yet.</li>'}</ul>
  <h3>Collected</h3><div class="row">${c.collected.map(i => `<span class="chip">${esc(i)}</span>`).join('') || '<span class="muted">Nothing yet.</span>'}</div>
  <p><button class="link" data-act="full">${ui.full ? 'Hide' : 'Read'} the whole story</button> <button class="link" data-act="restart">New campaign</button></p>
  ${ui.full ? c.beats.map(beatHtml).join('') : ''}`;
}
const kb = n => Math.round(n / 1000) + ' KB';
const meter = () => { const s = storage(); return `<div class="card"><b>Storage: ${s.pct}% used</b> (${kb(s.used)} of ${kb(s.limit)})<div class="bar ${s.pct >= 80 ? 'hot' : ''}"><i style="width:${s.pct}%"></i></div><small class="muted">Your habits, current campaign and past campaigns share this ${kb(s.limit)} limit. ${s.measured ? 'Your campaigns average' : 'A typical 14-day campaign uses'} about ${kb(s.avg)}, so there is room for roughly ${s.room} more. When storage is full, new changes stop syncing to your account until you export and delete old campaigns.</small></div>`; };
const stamp = h => h.status === 'completed' ? `<span class="badge ${h.ending}">${h.ending} ending</span>` : '<span class="badge">ended early</span>';
function past() {
  const h = state.history, v = ui.viewing && h.find(x => x.id === ui.viewing);
  if (v) return `<p><button class="link" data-act="back">Back to past campaigns</button></p><h2>${esc(v.hero)}</h2>
  <p class="muted">${esc(v.genre)}, ${v.start} to ${v.endedOn}, ${v.length}-day plan</p>
  <div class="card">${stamp(v)} ${pct(v.final.ratio)} of effort points earned (${v.final.got}/${v.final.max}) over ${v.beats.length} story beats.</div>
  <h3>Highlights</h3><ul>${v.beats.map(b => `<li>Day ${b.day}: ${esc(b.highlight)}</li>`).join('') || '<li class="muted">None.</li>'}</ul>
  <h3>Collected</h3><div class="row">${v.collected.map(i => `<span class="chip">${esc(i)}</span>`).join('') || '<span class="muted">Nothing.</span>'}</div>
  <p><button class="link" data-act="full">${ui.full ? 'Hide' : 'Read'} the whole story</button> <button class="link" data-act="export" data-id="${v.id}">Export story</button> <button class="link" data-act="rmpast" data-id="${v.id}">Delete this campaign</button></p>
  ${ui.full ? v.beats.map(beatHtml).join('') : ''}`;
  return `<h2>Past campaigns</h2>${meter()}${h.length ? '<p><button class="link" data-act="exportall">Export all as a backup file</button></p>' : ''}${h.map(x => `<button class="card hist" data-act="open" data-id="${x.id}"><h3>${esc(x.hero)}</h3><div>${stamp(x)} ${pct(x.final.ratio)}</div><small class="muted">${esc(x.genre)}, ${x.start} to ${x.endedOn}, ${x.beats.length} beats</small></button>`).join('') || '<p class="muted">Finished campaigns show up here. Finish a campaign, or start a new one from the Summary page, and it will be saved.</p>'}`;
}
const pct = r => Math.round(r * 100) + '%';
export const render = v => ({ today: today_, habits, story, summary, past }[v])();
