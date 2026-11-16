// Pure game logic: schedules, scoring (recalculated from current habits), chaos, endings.
export const today = () => new Date().toLocaleDateString('en-CA');
export const uid = () => Math.random().toString(36).slice(2, 9);
const at = d => new Date(d + 'T12:00');
export const diff = (a, b) => Math.round((at(b) - at(a)) / 864e5);
export const addDays = (d, n) => { const x = at(d); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
export function isDue(t, date, start) {
  if (!t.active) return false;
  if (t.freq === 'daily') return true;
  if (t.freq === 'days') return t.days.includes(at(date).getDay());
  if (t.freq === 'every') return diff(start, date) % Math.max(1, t.every) === 0;
  return false;
}
export const dayNumber = c => Math.max(1, Math.min(c.length, diff(c.start, today()) + 1));
export function score(s) {
  const c = s.campaign; let got = 0, max = 0;
  for (let i = 0; i < dayNumber(c); i++) {
    const d = addDays(c.start, i);
    for (const t of s.tasks) if (isDue(t, d, c.start)) { max += t.points; if ((s.done[d] || []).includes(t.id)) got += t.points; }
  }
  return { got, max, ratio: max ? got / max : 1 };
}
export const ending = r => r >= .75 ? 'good' : r >= .45 ? 'mid' : 'bad';
// d20 + meter bonus; a twist resets the meter, a calm beat raises it.
export function rollChaos(meter) {
  const roll = 1 + Math.floor(Math.random() * 20);
  const twist = roll + Math.floor(meter / 10) >= 18;
  return { roll, twist, meter: twist ? Math.max(0, meter - 60) : Math.min(100, meter + 8 + Math.floor(Math.random() * 8)) };
}
