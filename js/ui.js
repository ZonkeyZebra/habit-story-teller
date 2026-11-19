// Views: pure functions returning HTML strings.
import { state, storage } from './store.js';
import { isDue, today, dayNumber, score, ending } from './engine.js';
import { icon, itemsOf } from './icons.js';
import { SCENES, sceneId } from './scenes.js';
export const ui = { editing: null, full: false, viewing: null };
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const FREQS = [['daily', 'Daily'], ['days', 'Certain Days'], ['every', 'Every N Days']];
const EFFORT = [[1, 'Quick'], [2, 'Easy'], [3, 'Medium'], [4, 'Hard'], [5, 'Epic']];
const empty = (h, p) => `<h2>${h}</h2><p class="note">${p}</p>`;
const gauge = m => `<svg class="gauge" viewBox="0 0 100 56" role="img" aria-label="Chaos ${m} of 100"><path class="trk" d="M10 50A40 40 0 0 1 90 50" pathLength="100"/><path class="val" d="M10 50A40 40 0 0 1 90 50" pathLength="100" style="stroke-dasharray:${m} 100"/><text x="50" y="48" text-anchor="middle">${m}</text></svg>`;
// Each beat shows the items its completed tasks earned: small icons in the title, then a labelled list.
const dayIcons = b => `<span class="day-icons" aria-hidden="true">${itemsOf(b).map(i => icon(i.icon, 24)).join('')}</span>`;
const foundList = b => { const it = itemsOf(b); return it.length ? `<ul class="found">${it.map(i => `<li>${icon(i.icon, 36)}<span><b>${esc(i.name)}</b><small>for ${esc(i.task)}</small></span></li>`).join('')}</ul>` : ''; };
const beatHtml = b => `<article class="beat"><h3>${dayIcons(b)}<span>Day ${b.day}: ${esc(b.highlight)}</span></h3>${b.twist ? '<span class="twist">Chaos twist (rolled ' + b.roll + ')</span>' : ''}${b.text.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('')}${foundList(b)}</article>`;
const highlights = beats => beats.length ? `<ul class="hl">${beats.map(b => `<li>${dayIcons(b)}<span>Day ${b.day}: ${esc(b.highlight)}</span></li>`).join('')}</ul>` : '<p class="note">None yet.</p>';
const collectedHtml = (beats, names) => {
  const all = beats.flatMap(b => b.items || []);
  return (names || []).map(n => `<span class="chip">${icon(all.find(i => i.name === n)?.icon || 'star', 20)}${esc(n)}</span>`).join('') || '<span class="note">Nothing yet.</span>';
};

function today_() {
  const c = state.campaign; if (!c) return empty('No campaign yet', 'Start one in the Story tab.');
  const d = today(), due = state.tasks.filter(t => isDue(t, d, c.start)), done = state.done[d] || [], n = dayNumber(c);
  const doneToday = due.filter(t => done.includes(t.id)).length, waiting = state.pending.length;
  const hint = c.ending ? 'This campaign has ended. See the Summary.'
    : !due.length ? ''
    : waiting ? `${waiting} finished ${waiting === 1 ? 'habit is' : 'habits are'} ready to become a story beat.`
    : `${doneToday} of ${due.length} habits done today. Each one you finish earns an item in the story.`;
  return `<h2>Day ${n} of ${c.length}</h2>
  <div class="progress" role="progressbar" aria-label="Campaign progress" aria-valuemin="1" aria-valuemax="${c.length}" aria-valuenow="${n}"><i style="width:${Math.round(n / c.length * 100)}%"></i></div>
  <ul class="tasks">${due.map(t => `<li><label><input type="checkbox" data-act="toggle" data-id="${t.id}" ${done.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span><b>${t.points}</b></label></li>`).join('') || '<li class="muted">Nothing due today.</li>'}</ul>
  ${hint ? `<p class="hint">${hint}</p>` : ''}
  ${c.ending ? '' : `<button class="primary" data-act="beat" ${waiting ? '' : 'disabled'}>Tell the next beat (${waiting})</button>`}
  <p class="hint small">Chaos and story length are in <a href="#settings">Settings</a>.</p>`;
}
// Progressive form: radio inputs styled as segmented buttons; CSS (:has) shows only the controls that apply.
function form(t) {
  const x = t || { name: '', freq: 'daily', days: [1, 2, 3, 4, 5], every: 2, points: 3 };
  return `<form id="taskform" class="card" data-id="${t?.id || ''}">
  <input name="name" placeholder="Habit or task" value="${esc(x.name)}" required aria-label="Name">
  <span class="lbl" id="lbl-freq">How often</span>
  <div class="seg" role="radiogroup" aria-labelledby="lbl-freq">${FREQS.map(([v, l]) => `<label><input type="radio" name="freq" value="${v}" ${x.freq === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
  <div class="when when-days"><span class="lbl">On these days</span><div class="row">${DAYS.map((n, i) => `<label class="chip"><input type="checkbox" name="d" value="${i}" ${x.days.includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div></div>
  <div class="when when-every"><label>Every <input name="every" type="number" min="1" max="30" value="${x.every}" style="width:80px"> days</label></div>
  <span class="lbl" id="lbl-effort">Effort</span>
  <div class="seg effort" role="radiogroup" aria-labelledby="lbl-effort">${EFFORT.map(([v, l]) => `<label><input type="radio" name="points" value="${v}" ${x.points === v ? 'checked' : ''}><span>${l}<small>${v}</small></span></label>`).join('')}</div>
  <button class="primary">${t ? 'Save changes' : 'Add habit'}</button> <button type="button" class="link" data-act="cancel">Cancel</button></form>`;
}
function habits() {
  const e = ui.editing;
  return `<h2>Habits</h2>${e ? form(state.tasks.find(t => t.id === e)) : '<button class="primary" data-act="new">Add a habit</button>'}
  <ul class="tasks">${state.tasks.map(t => `<li><label style="cursor:default"><span>${esc(t.name)}<br><small class="muted">${t.freq === 'daily' ? 'Daily' : t.freq === 'days' ? t.days.map(i => DAYS[i]).join(' ') : 'Every ' + t.every + ' days'}</small></span><b>${t.points}</b><button class="link" data-act="edit" data-id="${t.id}">Edit</button><button class="link" data-act="del" data-id="${t.id}">Delete</button></label></li>`).join('')}</ul>
  ${state.campaign ? '<p class="note">Edits recalculate your score for the whole campaign.</p>' : ''}`;
}
function story() {
  const c = state.campaign;
  if (!c) return `<h2>Start a story</h2><form id="campform" class="card"><input name="hero" placeholder="Main character (name and a line about them)" required><input name="genre" placeholder="Genre and tone (e.g. cozy fantasy)" required><textarea name="notes" rows="3" placeholder="Anything you want in the story (places, side characters, themes)"></textarea><label>Length in days <input name="length" type="number" min="3" max="90" value="14" style="width:90px"></label><button class="primary">Begin campaign</button></form>`;
  return `<h2>${esc(c.hero)}</h2>${c.beats.map(beatHtml).join('') || '<p class="note">Complete habits on Today, then tell your first beat.</p>'}
  ${!c.ending && dayNumber(c) >= c.length ? `<button class="primary" data-act="finale">Write the finale</button>` : ''}`;
}
function summary() {
  const c = state.campaign; if (!c) return empty('Summary', 'Nothing yet. Start a campaign first.');
  const sc = score(state), pct = Math.round(sc.ratio * 100);
  return `<h2>Summary</h2><div class="card">${pct}% of effort points earned (${sc.got}/${sc.max}). ${c.ending ? `Ending: <b>${c.ending}</b>.` : `Heading toward a <b>${ending(sc.ratio)}</b> ending.`}</div>
  <h3>Highlights</h3>${highlights(c.beats)}
  <h3>Collected</h3><div class="row">${collectedHtml(c.beats, c.collected)}</div>
  <p><button class="link" data-act="full">${ui.full ? 'Hide' : 'Read'} the whole story</button> <button class="link" data-act="restart">New campaign</button></p>
  ${ui.full ? c.beats.map(beatHtml).join('') : ''}`;
}
// Settings: every control saves as soon as it changes and says so ("Saved"), so there is no save button to forget.
function settings() {
  const s = state.settings, c = state.campaign, cur = sceneId(state);
  const scenes = `<section class="card"><fieldset><legend>Scene</legend><p class="help">The picture behind the app. It changes right away.</p>
    <div class="scene-grid">${SCENES.map(x => `<label class="scene-opt"><input type="radio" name="scene" value="${x.id}" data-act="scene" ${cur === x.id ? 'checked' : ''}><span class="thumb" data-scene="${x.id}"></span><span class="scene-name">${x.name}</span></label>`).join('')}</div></fieldset></section>`;
  let story;
  if (!c) story = `<section class="card"><h3>Story</h3><p class="help">Start a story to change its length, chaos and details.</p><a class="primary" href="#story">Start a story</a></section>`;
  else {
    const min = Math.max(3, dayNumber(c));
    story = `<section class="card"><fieldset ${c.ending ? 'disabled' : ''}><legend>Story</legend>
    <p class="help">${c.ending ? 'This campaign has ended, so its settings are locked.' : 'Changes save when you finish editing a field.'}</p>
    <label class="lbl" for="s-hero">Main character</label><input id="s-hero" name="hero" data-act="story" value="${esc(c.hero)}">
    <label class="lbl" for="s-genre">Genre and tone</label><input id="s-genre" name="genre" data-act="story" value="${esc(c.genre)}">
    <label class="lbl" for="s-notes">Notes for the storyteller</label><textarea id="s-notes" name="notes" rows="3" data-act="story">${esc(c.notes)}</textarea>
    <label class="lbl" for="s-length">Length in days</label><input id="s-length" name="length" type="number" min="${min}" max="90" value="${c.length}" data-act="story" aria-describedby="h-length" style="width:110px">
    <p class="help" id="h-length">It is day ${dayNumber(c)} now, so the shortest length is ${min}. The longest is 90.</p>
    <div class="meter">${gauge(c.chaos)}<label class="chaos-control"><span>Chaos for the next story beat: <output id="chaos-value">${c.chaos}</output>/100</span><input type="range" min="0" max="100" value="${c.chaos}" data-act="chaos" aria-describedby="h-chaos"></label></div>
    <p class="help" id="h-chaos">Higher chaos makes a plot twist more likely. A twist resets it to a low number, and calm beats raise it.</p></fieldset></section>`;
  }
  const popups = `<section class="card"><fieldset><legend>Item pop-ups</legend>
    <label class="check"><input type="checkbox" data-act="popups" ${s.popups ? 'checked' : ''}><span>Show a pop-up when a story beat finds items</span></label>
    <span class="lbl" id="lbl-secs">How long it stays</span>
    <div class="seg" role="radiogroup" aria-labelledby="lbl-secs">${[4, 6, 10].map(n => `<label><input type="radio" name="popupsecs" value="${n}" data-act="popupsecs" ${s.popupSecs === n ? 'checked' : ''} ${s.popups ? '' : 'disabled'}><span>${n} seconds</span></label>`).join('')}</div>
    <p class="help">Point at a pop-up, or tab to it, to pause its timer. You can close it any time.</p></fieldset></section>`;
  const account = `<section class="card"><h3>Account</h3><button class="primary" data-act="signout">Sign out</button></section>`;
  return `<h2>Settings</h2>${scenes}${story}${popups}${account}`;
}
const kb = n => Math.round(n / 1000) + ' KB';
const meter = () => { const s = storage(); return `<div class="card"><b>Storage: ${s.pct}% used</b> (${kb(s.used)} of ${kb(s.limit)})<div class="bar ${s.pct >= 80 ? 'hot' : ''}"><i style="width:${s.pct}%"></i></div><small class="muted">Your habits, current campaign and past campaigns share this ${kb(s.limit)} limit. ${s.measured ? 'Your campaigns average' : 'A typical 14-day campaign uses'} about ${kb(s.avg)}, so there is room for roughly ${s.room} more. When storage is full, new changes stop syncing to your account until you export and delete old campaigns.</small></div>`; };
const stamp = h => h.status === 'completed' ? `<span class="badge ${h.ending}">${h.ending} ending</span>` : '<span class="badge">ended early</span>';
function past() {
  const h = state.history, v = ui.viewing && h.find(x => x.id === ui.viewing);
  if (v) return `<p><button class="link" data-act="back">Back to past campaigns</button></p><h2>${esc(v.hero)}</h2>
  <p class="note">${esc(v.genre)}, ${v.start} to ${v.endedOn}, ${v.length}-day plan</p>
  <div class="card">${stamp(v)} ${pct(v.final.ratio)} of effort points earned (${v.final.got}/${v.final.max}) over ${v.beats.length} story beats.</div>
  <h3>Highlights</h3>${highlights(v.beats)}
  <h3>Collected</h3><div class="row">${collectedHtml(v.beats, v.collected)}</div>
  <p><button class="link" data-act="full">${ui.full ? 'Hide' : 'Read'} the whole story</button> <button class="link" data-act="export" data-id="${v.id}">Export story</button> <button class="link" data-act="rmpast" data-id="${v.id}">Delete this campaign</button></p>
  ${ui.full ? v.beats.map(beatHtml).join('') : ''}`;
  return `<h2>Past campaigns</h2>${meter()}${h.length ? '<p><button class="link" data-act="exportall">Export all as a backup file</button></p>' : ''}${h.map(x => `<button class="card hist" data-act="open" data-id="${x.id}"><h3>${esc(x.hero)}</h3><div>${stamp(x)} ${pct(x.final.ratio)}</div><small class="muted">${esc(x.genre)}, ${x.start} to ${x.endedOn}, ${x.beats.length} beats</small></button>`).join('') || '<p class="note">Finished campaigns show up here. Finish a campaign, or start a new one from the Summary page, and it will be saved.</p>'}`;
}
const pct = r => Math.round(r * 100) + '%';
export const render = v => ({ today: today_, habits, story, summary, past, settings }[v])();
