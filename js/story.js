// Builds the prompt (memory = rolling summary + last 3 beats) and parses the reply.
import { generate } from './api.js';
import { score, rollChaos, ending, dayNumber } from './engine.js';
const SYS = 'You narrate a serialized story powered by a person\'s real-life habits. Reply with ONLY a JSON object, no markdown: {"text":"a story beat of 2-3 short paragraphs, about 200 words","summary":"updated running summary of the whole story so far, under 150 words","highlight":"one-line headline for this beat","collected":["0-2 short names of items, allies or discoveries gained"]}. Never contradict established facts and avoid repeating earlier plot devices.';
// Pull the JSON object out of the reply even if the model adds stray text; null if unusable or cut off.
const parse = t => { try { const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); return typeof o.text === 'string' && typeof o.summary === 'string' ? o : null; } catch { return null; } };
export async function nextBeat(s, pending, kind) {
  const c = s.campaign, ch = rollChaos(c.chaos), sc = score(s), tier = ending(sc.ratio);
  const prompt = [
    `Hero: ${c.hero}\nGenre/tone: ${c.genre}\nNotes: ${c.notes || 'none'}`,
    `Story so far: ${c.summary || '(not started)'}`,
    `Last beats:\n${c.beats.slice(-3).map(b => b.text).join('\n---\n') || '(none)'}`,
    `Day ${dayNumber(c)} of ${c.length}. Habit performance: ${Math.round(sc.ratio * 100)}% (heading toward a ${tier} ending).`,
    `Real-life actions just completed (show them as in-story deeds, don't list them): ${pending.map(t => `${t.name} (effort ${t.points}/5)`).join(', ') || 'none'}`,
    ch.twist ? 'CHAOS EVENT: introduce a surprising complication or twist.' : `Keep momentum steady (chaos ${c.chaos}/100).`,
    kind === 'finale' ? `FINALE: write a ${tier.toUpperCase()} ending (good=triumphant, mid=bittersweet, bad=failure or loss) that reflects the journey.` : 'Advance the story by one beat.'
  ].join('\n\n');
  let j = null;
  for (let i = 0; i < 2 && !j; i++) j = parse((await generate(SYS, prompt)).text); // one automatic retry if the reply was cut off
  if (!j) throw new Error('The story came back incomplete. Please try again.');
  return { beat: { day: dayNumber(c), text: j.text, highlight: j.highlight, roll: ch.roll, twist: ch.twist, tasks: pending.map(t => t.name), kind }, summary: j.summary, collected: j.collected || [], chaos: ch.meter };
}
