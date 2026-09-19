#!/usr/bin/env node
/** Read a published figure's colourbar: the colours along it and the transfer function its printed ticks follow, so a lens is
 * drawn on the publisher's own scale in the publisher's own colours rather than on one chosen here.
 *
 *   node tools/objects/circumstellar/colourbar.mts <figure.png> <x0> <x1> <y0> <y1> <value>@<x> [<value>@<x> ...]
 *
 * x0..x1 and y0..y1 are the bar's interior in figure pixels; each tick is a printed label value and the pixel column its
 * label is centred on. The stretch fitted is the logarithmic one astronomical figures print, y = log(1 + a u) / log(1 + a)
 * with u = (v - vmin) / (vmax - vmin): vmax is the bar's top label, and a and vmin are fitted to the ticks. The four stops
 * are the bar's colours at its quarters, which is all an RGBA8 grid carries: tent weights over them interpolate the bar and
 * zero is black, as betelgeuse-shell/author.mts does with inferno. The figure is read, never retained; only these numbers
 * are, in the recipe that cites it. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export interface LogBar { readonly vmin: number; readonly vmax: number; readonly a: number }
/** Position along the bar, 0 to 1, of a value; below vmin is 0 and above vmax is 1. */
export function logBarPosition(bar: LogBar, value: number) {
  const u = Math.max(0, Math.min(1, (value - bar.vmin) / (bar.vmax - bar.vmin)));
  return Math.log(1 + bar.a * u) / Math.log(1 + bar.a);
}
/** The value at a position along the bar. */
export function logBarValue(bar: LogBar, position: number) {
  return bar.vmin + (bar.vmax - bar.vmin) * (Math.exp(position * Math.log(1 + bar.a)) - 1) / bar.a;
}
/** Tent weights over four stops at the bar's quarters: their weighted sum interpolates the bar, and below the first stop it
 * fades to black. */
export const quarterWeights = (position: number) => [0, 1, 2, 3].map(k => Math.max(0, 1 - Math.abs(Math.max(0, Math.min(1, position)) * 4 - (k + 1))));

/** Fit a and vmin to the ticks by a grid search refined four times; vmax is the largest tick. */
export function fitLogBar(ticks: readonly { value: number; position: number }[]) {
  if (ticks.length < 3) throw new RangeError('Three ticks at least fix a logarithmic bar.');
  const vmax = Math.max(...ticks.map(tick => tick.value)), lowest = Math.min(...ticks.map(tick => tick.value));
  const error = (bar: LogBar) => Math.max(...ticks.map(tick => Math.abs(logBarPosition(bar, tick.value) - tick.position)));
  let best = { bar: { vmin: lowest - 1, vmax, a: 10 }, error: Infinity };
  let [logA0, logA1, v0, v1] = [-1, 5, lowest - 5 * Math.max(1, Math.abs(lowest)), lowest - 1e-6];
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) {
      const bar = { vmin: v0 + (v1 - v0) * j / 60, vmax, a: 10 ** (logA0 + (logA1 - logA0) * i / 60) };
      const e = error(bar); if (e < best.error) best = { bar, error: e };
    }
    const la = Math.log10(best.bar.a), dla = (logA1 - logA0) / 20, dv = (v1 - v0) / 20;
    [logA0, logA1, v0, v1] = [la - dla, la + dla, best.bar.vmin - dv, Math.min(lowest - 1e-6, best.bar.vmin + dv)];
  }
  return best;
}

export async function readColourbar(figure: string, box: { x0: number; x1: number; y0: number; y1: number }, ticks: readonly { value: number; x: number }[]) {
  const { data, info } = await sharp(await readFile(figure)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number) => {
    // The ends are sampled two pixels inside the bar's outline.
    const column = Math.min(box.x1 - 2, Math.max(box.x0 + 2, Math.round(box.x0 + x * (box.x1 - box.x0)))), sum = [0, 0, 0];
    for (let y = box.y0; y <= box.y1; y++) for (let c = 0; c < 3; c++) sum[c]! += data[(y * info.width + column) * info.channels + c]!;
    return sum.map(value => Math.round(value / (box.y1 - box.y0 + 1))) as [number, number, number];
  };
  const fit = fitLogBar(ticks.map(tick => ({ value: tick.value, position: (tick.x - box.x0) / (box.x1 - box.x0) })));
  return { bar: fit.bar, tickErrorPixels: fit.error * (box.x1 - box.x0), bottom: at(0), stops: [0.25, 0.5, 0.75, 1].map(at) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [figure, x0, x1, y0, y1, ...tickArgs] = process.argv.slice(2);
  if (!figure || !y1 || tickArgs.length < 3) throw new TypeError('Usage: colourbar <figure.png> <x0> <x1> <y0> <y1> <value>@<x> ...');
  const ticks = tickArgs.map(arg => { const [value, x] = arg.split('@').map(Number); return { value: value!, x: x! }; });
  const result = await readColourbar(resolve(figure), { x0: Number(x0), x1: Number(x1), y0: Number(y0), y1: Number(y1) }, ticks);
  console.log(JSON.stringify({ ...result, bar: { ...result.bar, vmin: +result.bar.vmin.toFixed(4), a: +result.bar.a.toFixed(3) }, tickErrorPixels: +result.tickErrorPixels.toFixed(2) }));
}
