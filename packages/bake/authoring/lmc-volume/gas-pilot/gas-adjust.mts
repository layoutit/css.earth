/** Measured excess over the accepted delivery, taken out of each group's gain; a final whole-frame scale keeps every view at or below it. */
import { readFile, writeFile } from 'node:fs/promises';
import { ALL_DIR } from './dots-all.mts';
const light = JSON.parse(await readFile(ALL_DIR + 'light.json', 'utf8')) as { id: string; ratio: number; added: number; referenceAdded: number; groups: Record<string, [number, number]> }[];
const adjust = JSON.parse(await readFile(ALL_DIR + 'adjust.json', 'utf8').catch(() => '{}')) as Record<string, number>, reduceOnly = process.argv.includes('--reduce'), worst: Record<string, number> = {};
for (const row of light) for (const [id, [a, r]] of Object.entries(row.groups)) if (r > 5 && a > 0) worst[id] = Math.max(worst[id] ?? 0, a / r);
for (const [id, v] of Object.entries(worst)) { const step = Math.max(.35, Math.min(reduceOnly ? 1 : 1.4, (.95 / v) ** (v > .95 ? 1.2 : .7))); adjust[id] = (adjust[id] ?? 1) * step; }
const whole = Math.max(...light.map(l => l.ratio));
const scale = Math.min(1, .97 / whole); if (scale < 1) for (const id of Object.keys(adjust)) adjust[id]! *= scale ** 1.2;
const sorted = Object.values(worst).sort((a, b) => b - a);
await writeFile(ALL_DIR + 'adjust.json', JSON.stringify(adjust) + '\n');
console.log(JSON.stringify({ whole: light.map(l => [l.id, +l.ratio.toFixed(3)]), groupsMeasured: sorted.length, worstGroup: sorted[0], p90: sorted[Math.floor(sorted.length * .1)], wholeWorst: whole }));
