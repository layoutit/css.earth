/** Reproduce the observed Figure 2(b) brightness colors from its vector bar and printed flux ticks. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

const root = projectRoot(import.meta.url), path = resolve(root, 'src/objects/hl-tauri-disc/source/alma-2015-figure-2-colormap.json');
const record = requireRecord(JSON.parse(await readFile(path, 'utf8')) as unknown), bar = requireRecord(record.vectorBar);
const top = requireFiniteNumber(bar.top), bottom = requireFiniteNumber(bar.bottom);
if (!(bottom > top)) throw new Error('The published bar has no height.');
const strips = requireArray(bar.strips).map(value => {
  const row = requireRecord(value), rgb = requireArray(row.rgb).map(channel => requireFiniteNumber(channel));
  if (rgb.length !== 3 || rgb.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255)) throw new Error('Invalid published RGB strip.');
  return { top: requireFiniteNumber(row.top), bottom: requireFiniteNumber(row.bottom), rgb };
});
if (strips.length !== 256) throw new Error('Expected the 256 vector-painted colors of the published bar.');
const ticks = requireArray(bar.ticks).map(value => {
  const tick = requireRecord(value);
  return { value: requireFiniteNumber(tick.jyPerBeam) * 1000, u: (bottom - requireFiniteNumber(tick.pageY)) / (bottom - top) };
});
if (ticks.length !== 9 || ticks.some(tick => !(tick.u > 0 && tick.u < 1))) throw new Error('Invalid published color-bar ticks.');
const withheld = [4, 8], training = ticks.filter((_, index) => !withheld.includes(index));
let best = { exponent: 0, offset: 0, scale: 0, sse: Infinity };
for (let k = 0; k <= 16000; k++) {
  const exponent = 1.2 + k * 0.0001, n = training.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const tick of training) { const x = tick.u ** exponent; sx += x; sy += tick.value; sxx += x*x; sxy += x*tick.value; }
  const scale = (n*sxy-sx*sy)/(n*sxx-sx*sx), offset = (sy-scale*sx)/n;
  const sse = training.reduce((sum, tick) => sum+(offset+scale*tick.u**exponent-tick.value)**2, 0);
  if (sse < best.sse) best = { exponent, offset, scale, sse };
}
const errors = ticks.map(tick => best.offset+best.scale*tick.u**best.exponent-tick.value);
if (!(best.scale > 0) || Math.max(...errors.map(Math.abs)) > 0.0001) throw new Error('The flux transfer does not reproduce the printed ticks within 0.1 microJy/beam.');
const range = [best.offset, best.offset+best.scale];
const rgb = Array.from({ length: 512 }, (_, index) => {
  const value = range[0]! + index * (range[1]!-range[0]!) / 511;
  const u = Math.max(0, Math.min(1, ((value-best.offset)/best.scale)**(1/best.exponent)));
  const y = bottom-u*(bottom-top);
  const strip = strips.find(entry => y >= entry.top-0.00001 && y <= entry.bottom+0.00001);
  if (!strip) throw new Error(`The published bar has no color at ${y}.`);
  return strip.rgb;
});
const source = 'ALMA Partnership et al. (2015), ApJL 808, L3, Figure 2(b), page 6 of arXiv:1503.02649v3. The 256 underlying vector-painted RGB rectangles supply the colors, excluding overlaid tick strokes. Their nine printed flux ticks calibrate a power transfer, fitted on seven ticks and checked on the withheld 0.6 and 3.0 mJy/beam ticks. The recovered bar runs from +0.022 to 5.832 mJy/beam, with display power approximately 0.55. The caption says -2 rms at the low end, but its tick positions reproduce +2 rms to within 0.1 microJy/beam; this table follows the actual calibrated bar. 512 entries sample equal flux intervals. This is a false-color brightness display for millimeter emission, not visible color.';
const output = { ...record, source, generator: 'node packages/telescope-cli/authoring/hl-tauri/color-map.mts', calibration: { exponent: best.exponent, offsetMjyPerBeam: best.offset, scaleMjyPerBeam: best.scale,
  rangeMjyPerBeam: range, withheldTickIndices: withheld, tickErrorsMjyPerBeam: errors }, rgb };
const text = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== text) throw new Error('Published color map differs from its vector measurements.');
} else await writeFile(path, text);
console.log(JSON.stringify({ rangeMjyPerBeam: range, displayPower: 1/best.exponent,
  maximumTickErrorMicroJy: Math.max(...errors.map(Math.abs))*1000, withheldTickErrorMicroJy: withheld.map(index => errors[index]!*1000) }));
