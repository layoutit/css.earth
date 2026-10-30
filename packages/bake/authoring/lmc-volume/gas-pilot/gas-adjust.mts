/** Measured excess over the accepted delivery, taken out of each group's gain; a final whole-frame scale keeps every view at or below it. */
import { readFile, writeFile } from 'node:fs/promises';
import { ALL_DIR } from './dots-all.mts';
const LOCKED_EARTH = .66, globalScale = (a: Record<string, number>, k: number) => { a['*'] = (a['*'] ?? 1) * k; };
const light = JSON.parse(await readFile(ALL_DIR + 'light.json', 'utf8')) as { id: string; ratio: number; added: number; referenceAdded: number; groups: Record<string, [number, number]>; darkeningRatio: number }[];
const adjust = JSON.parse(await readFile(ALL_DIR + 'adjust.json', 'utf8').catch(() => '{}')) as Record<string, number>, reduceOnly = process.argv.includes('--reduce'), worst: Record<string, number> = {};
for (const row of light) for (const [id, [a, r]] of Object.entries(row.groups)) if (r > 5 && a > 0) worst[id] = Math.max(worst[id] ?? 0, a / r);
for (const [id, v] of Object.entries(worst)) { const step = Math.max(.35, Math.min(reduceOnly ? 1 : 1.4, (.95 / v) ** (v > .95 ? 1.3 : .5))); adjust[id] = (adjust[id] ?? 1) * step; }
const whole = Math.max(...light.map(l => l.ratio));
// The top-down look is locked: Earth's whole-frame light stays where the owner approved it.
if (process.argv.includes('--lock')) { const earth = light.find(l => l.id === 'earth')!.ratio, scale = (LOCKED_EARTH / earth) ** 1.2; for (const r of Object.keys(worst)) adjust[r] = adjust[r] ?? 1; globalScale(adjust, scale); }
if (process.argv.includes('--lock')) { const dark = light.filter(l => ['earth', 'pz', 'tilt45'].includes(l.id)).map(l => l.darkeningRatio), mean = dark.reduce((a, b) => a + b, 0) / dark.length; if (mean > 0) adjust.dust = (adjust.dust ?? 1) * Math.max(.3, Math.min(3, 1 / mean)); }
const sorted = Object.values(worst).sort((a, b) => b - a);
await writeFile(ALL_DIR + 'adjust.json', JSON.stringify(adjust) + '\n');
console.log(JSON.stringify({ dark: light.map(l => [l.id, +l.darkeningRatio.toFixed(3)]), dustGain: adjust.dust, whole: light.map(l => [l.id, +l.ratio.toFixed(3)]), groupsMeasured: sorted.length, worstGroup: sorted[0], p90: sorted[Math.floor(sorted.length * .1)], wholeWorst: whole }));
