// Builds the prompt (memory = rolling summary + last 3 beats) and parses the reply.
import { generate } from './api.js';
import { score, rollChaos, ending, dayNumber } from './engine.js';
import { ITEM_ICONS, cleanItem } from './icons.js';
const SYS = 'You narrate a serialized story powered by a person\'s real-life habits. Reply with ONLY a JSON object, no markdown: {"text":"a story beat of 2-3 short paragraphs, about 200 words","summary":"updated running summary of the whole story so far, under 150 words","highlight":"one-line headline for this beat","items":[{"task":"the exact name of one completed real-life action","name":"a 2-4 word item the hero finds because of that deed","icon":"one of: ' + ITEM_ICONS.join(', ') + '"}]}. Give exactly one item per completed action listed and work each item naturally into the text. Never contradict established facts and avoid repeating earlier plot devices.';
// Pull the JSON object out of the reply even if the model adds stray text; null if unusable or cut off.
const parse = t => {
  if (typeof t !== 'string') return null;
  try {
    const start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end < start) return null;
    const o = JSON.parse(t.slice(start, end + 1));
    if (typeof o.text !== 'string' || !o.text.trim() || typeof o.summary !== 'string' || typeof o.highlight !== 'string') return null;
    if (o.items !== undefined && !Array.isArray(o.items)) o.items = [];
    return o;
  } catch { return null; }
};
export async function nextBeat(s, pending, kind) {
  const c = s.campaign, ch = rollChaos(c.chaos), sc = score(s), tier = ending(sc.ratio);
  const prompt = [
    `Hero: ${c.hero}\nGenre/tone: ${c.genre}\nNotes: ${c.notes || 'none'}`,
    `Story so far: ${c.summary || '(not started)'}`,
    `Last beats:\n${c.beats.slice(-3).map(b => b.text).join('\n---\n') || '(none)'}`,
    `Day ${dayNumber(c)} of ${c.length}. Habit performance: ${Math.round(sc.ratio * 100)}% (heading toward a ${tier} ending).`,
    `Real-life actions just completed (show them as in-story deeds, don't list them): ${pending.map(t => `${t.name} (effort ${t.points}/5)`).join(', ') || 'none'}`,
    `Items already found (do not repeat): ${c.collected.slice(-12).join(', ') || 'none'}`,
    ch.twist ? 'CHAOS EVENT: introduce a surprising complication or twist.' : `Keep momentum steady (chaos ${c.chaos}/100).`,
    kind === 'finale' ? `FINALE: write a ${tier.toUpperCase()} ending (good=triumphant, mid=bittersweet, bad=failure or loss) that reflects the journey.` : 'Advance the story by one beat.'
  ].join('\n\n');
  let j = null;
  for (let i = 0; i < 2 && !j; i++) j = parse((await generate(SYS, prompt)).text); // one automatic retry if the reply was cut off
  if (!j) throw new Error('The story came back incomplete. Please try again.');
  // One item per completed task, matched by name; anything the story left out gets a stand-in item.
  const items = pending.map(t => cleanItem(t.name, (j.items || []).find(i => i && typeof i.task === 'string' && i.task.trim().toLowerCase() === t.name.toLowerCase())));
  return { beat: { day: dayNumber(c), text: j.text, highlight: j.highlight, roll: ch.roll, twist: ch.twist, tasks: pending.map(t => t.name), items, kind }, summary: j.summary, collected: items.map(i => i.name), chaos: ch.meter };
}
