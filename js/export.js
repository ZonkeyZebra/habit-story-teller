// Downloads: a readable story file per campaign, or a JSON backup of all past campaigns.
import { itemsOf } from './icons.js';
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'story';
export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function storyMarkdown(h) {
  const end = h.status === 'completed' ? `${h.ending} ending` : 'ended early';
  return [`# ${h.hero}`,
    `${h.genre}. ${h.start} to ${h.endedOn}. ${end}, ${Math.round(h.final.ratio * 100)}% of effort points earned (${h.final.got}/${h.final.max}).`,
    ...h.beats.map(b => { const it = itemsOf(b); return `## Day ${b.day}: ${b.highlight}\n\n${b.text}` + (it.length ? '\n\n' + it.map(i => `- Found: ${i.name} (for ${i.task})`).join('\n') : ''); }),
    h.collected.length ? `## Collected\n\n${h.collected.map(i => '- ' + i).join('\n')}` : ''
  ].filter(Boolean).join('\n\n') + '\n';
}
