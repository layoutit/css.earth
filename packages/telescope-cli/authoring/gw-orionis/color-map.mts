/** Reproduce the brightness colors of Kraus et al. (2020) Figure 1A from its color bar and printed flux ticks.
 *
 *   node packages/telescope-cli/authoring/gw-orionis/color-map.mts [--check]
 *   node packages/telescope-cli/authoring/gw-orionis/color-map.mts --read <page.png>
 *
 * The figure is a raster in the paper's PDF. `--read` takes that page rendered to a PNG and records what was measured on it:
 * the bar's top and bottom rows, the rows of its tick marks and 256 colors up its middle column. Without `--read` the record
 * is turned into the table the disc author reads: the ticks calibrate a power transfer from brightness to height on the bar,
 * and the table samples the bar's colors at equal steps of brightness. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

const root = projectRoot(import.meta.url), path = resolve(root, 'src/objects/gw-orionis-disc/source/kraus-2020-figure-1-colormap.json');
const TICKS = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0], ENTRIES = 1024, SAMPLES = 256;
const args = process.argv.slice(2), readFrom = args[args.indexOf('--read') + 1];

if (args.includes('--read')) {
  if (!readFrom) throw new TypeError('Usage: color-map.mts --read <page.png>');
  const { data, info } = await sharp(readFrom).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => [data[(y * info.width + x) * 3]!, data[(y * info.width + x) * 3 + 1]!, data[(y * info.width + x) * 3 + 2]!] as const;
  const white = (c: readonly number[]) => c.every(v => v > 245), dark = (c: readonly number[]) => c.every(v => v < 90);
  // Panel A's bar is the first block wider than a tick label's stroke that is not white, on a row a fifth of the way down the
  // page. The panel touches it, so the column read is a fixed step inside the bar's left edge, and the ticks a step outside it.
  const row = Math.round(info.height * 0.2);
  let left = 0, run = 0;
  for (let x = 0; x < info.width && run < 30; x++) { if (white(at(x, row))) run = 0; else { if (run === 0) left = x; run++; } }
  if (run < 30) throw new Error('No color bar was found on the page.');
  const column = left + 22, tickColumn = left - 6;
  // Tick marks are short dark runs just left of the bar; panel A's nine are the first nine from the top.
  const runs: number[] = []; let start = -1;
  for (let y = 0; y < info.height; y++) { const on = dark(at(tickColumn, y)); if (on && start < 0) start = y; if (!on && start >= 0) { if (y - start < 14) runs.push((start + y - 1) / 2); start = -1; } }
  if (runs.length < TICKS.length) throw new Error(`Only ${runs.length} tick marks were found left of the bar.`);
  const ticks = TICKS.map((mJyPerBeam, index) => ({ mJyPerBeam, row: runs[index]! }));
  let top = 0; while (white(at(column, top))) top++;
  const bottom = ticks.at(-1)!.row, colors = Array.from({ length: SAMPLES }, (_, k) => [...at(column, Math.round(bottom - (k + 0.5) / SAMPLES * (bottom - top)))]);
  const record = { schema: 'cssearth-figure-colormap@1', rasterBar: { page: { width: info.width, height: info.height }, column, tickColumn, top, bottom, ticks, colors } };
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ column, top, bottom, ticks: ticks.map(tick => tick.row) }));
}

const record = requireRecord(JSON.parse(await readFile(path, 'utf8')) as unknown), bar = requireRecord(record.rasterBar, 'rasterBar');
const top = requireFiniteNumber(bar.top), bottom = requireFiniteNumber(bar.bottom);
if (!(bottom > top)) throw new Error('The published bar has no height.');
const colors = requireArray(bar.colors).map(value => { const rgb = requireArray(value).map(channel => requireFiniteNumber(channel)); if (rgb.length !== 3 || rgb.some(c => !Number.isInteger(c) || c < 0 || c > 255)) throw new Error('Invalid bar color.'); return rgb; });
const ticks = requireArray(bar.ticks).map(value => { const tick = requireRecord(value); return { value: requireFiniteNumber(tick.mJyPerBeam), u: (bottom - requireFiniteNumber(tick.row)) / (bottom - top) }; });
if (colors.length !== SAMPLES || ticks.length !== TICKS.length) throw new Error('The record holds another bar than the one this script reads.');
// brightness = top * u^exponent, through zero, where the 0.0 tick sits on the bar's bottom edge. Two ticks are withheld from the fit.
const positive = ticks.filter(tick => tick.value > 0), withheld = [2, 6], training = positive.filter((_, index) => !withheld.includes(index));
let best = { exponent: 0, top: 0, sse: Infinity };
for (let k = 0; k <= 40000; k++) {
  const exponent = 2 + k * 0.0001, sxx = training.reduce((sum, tick) => sum + tick.u ** (2 * exponent), 0), sxy = training.reduce((sum, tick) => sum + tick.u ** exponent * tick.value, 0);
  const scale = sxy / sxx, sse = training.reduce((sum, tick) => sum + (scale * tick.u ** exponent - tick.value) ** 2, 0);
  if (sse < best.sse) best = { exponent, top: scale, sse };
}
const errors = positive.map(tick => best.top * tick.u ** best.exponent - tick.value);
if (!(best.top > 0) || Math.max(...errors.map(Math.abs)) > 0.003) throw new Error(`The flux transfer misses a printed tick by ${(Math.max(...errors.map(Math.abs)) * 1000).toFixed(1)} microJy/beam.`);
const rgb = Array.from({ length: ENTRIES }, (_, index) => {
  const u = (index / (ENTRIES - 1)) ** (1 / best.exponent), f = Math.max(0, Math.min(SAMPLES - 1, u * SAMPLES - 0.5)), k = Math.min(SAMPLES - 2, Math.floor(f)), t = f - k;
  return colors[k]!.map((channel, c) => Math.round(channel * (1 - t) + colors[k + 1]![c]! * t));
});
const source = `Kraus et al. (2020), Science 369, 1233, Figure 1A, as printed in the paper's accepted manuscript (ESO release eso2014, science paper eso2014a.pdf, page 20). The figure is a raster: ${SAMPLES} colors read up the middle of its color bar supply the colors, and its nine printed flux ticks calibrate a power transfer through zero, fitted on six ticks and checked on the withheld 0.6 and 0.2 mJy/beam ticks. The recovered bar runs from 0 to ${best.top.toFixed(3)} mJy/beam with display power ${(1 / best.exponent).toFixed(3)}; the printed ticks are reproduced to ${(Math.max(...errors.map(Math.abs)) * 1000).toFixed(1)} microJy/beam. ${ENTRIES} entries sample equal flux intervals. This is a false-color brightness display for millimeter emission, not visible color.`;
const output = { schema: 'cssearth-figure-colormap@1', source, generator: 'node packages/telescope-cli/authoring/gw-orionis/color-map.mts', rasterBar: bar,
  calibration: { exponent: best.exponent, rangeMjyPerBeam: [0, best.top], withheldTickIndices: withheld, tickErrorsMjyPerBeam: errors }, rgb };
const text = `${JSON.stringify(output, null, 2)}\n`;
if (args.includes('--check')) { if (await readFile(path, 'utf8') !== text) throw new Error('The color map differs from its measured bar.'); }
else await writeFile(path, text);
console.log(JSON.stringify({ rangeMjyPerBeam: [0, best.top], displayPower: 1 / best.exponent, maximumTickErrorMicroJy: Math.max(...errors.map(Math.abs)) * 1000, withheldTickErrorMicroJy: withheld.map(index => errors[index]! * 1000) }));
