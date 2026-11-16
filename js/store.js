// App state: cached in localStorage, synced to the Worker (debounced).
import { loadData, saveData } from './api.js';
const blank = () => ({ tasks: [], campaign: null, done: {}, pending: [] });
export let state = blank();
let timer;
export async function init() {
  try { state = { ...blank(), ...((await loadData()).data || {}) }; localStorage.setItem('hst', JSON.stringify(state)); }
  catch (e) { if (e.auth) throw e; state = { ...blank(), ...JSON.parse(localStorage.getItem('hst') || '{}') }; }
}
export function save() {
  localStorage.setItem('hst', JSON.stringify(state));
  clearTimeout(timer);
  timer = setTimeout(() => saveData(state).catch(e => { if (e.auth) window.dispatchEvent(new Event('reauth')); }), 800);
}
