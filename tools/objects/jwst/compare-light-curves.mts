#!/usr/bin/env node
/** Compare two exported light curves of the same exposures (reduce-tso.mts CSV: time, flux, err, mask, centroid_y, psf_width_y).
 *
 *   node tools/objects/jwst/compare-light-curves.mts <ours.csv> <author.csv>
 *
 * Integrations pair when their times agree within one second, and a pair counts when neither is masked and both are finite.
 * Both curves are divided by their median over the pairs. Reported: the correlation, the spread of the difference, the spread
 * after a straight line in time is removed from the difference (a slow drift between reductions changes a map's baseline terms,
 * not its shape, and is fitted there anyway), each curve's point-to-point scatter (the standard deviation of successive
 * differences over the square root of two) and each median error. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface LightCurve { readonly time: Float64Array; readonly flux: Float64Array; readonly err: Float64Array; readonly mask: Uint8Array }

export function parseLightCurve(text: string): LightCurve {
  const [header, ...lines] = text.trim().split('\n');
  const names = header!.split(','), column = (name: string) => { const index = names.indexOf(name); if (index < 0) throw new TypeError(`The light curve has no ${name} column.`); return index; };
  const rows = lines.map(line => line.split(',').map(Number)), [t, f, e, m] = ['time', 'flux', 'err', 'mask'].map(column) as [number, number, number, number];
  return { time: Float64Array.from(rows, row => row[t]!), flux: Float64Array.from(rows, row => row[f]!), err: Float64Array.from(rows, row => row[e]!), mask: Uint8Array.from(rows, row => (row[m] ? 1 : 0)) };
}

const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[sorted.length >> 1]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2; };
const std = (values: readonly number[]) => { const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length); };
const scatter = (values: readonly number[]) => std(values.slice(1).map((value, i) => value - values[i]!)) / Math.SQRT2;

export function compareLightCurves(ours: LightCurve, author: LightCurve) {
  const pairs: { time: number; a: number; b: number; ea: number; eb: number }[] = [];
  let j = 0;
  for (let i = 0; i < ours.time.length; i++) {
    while (j + 1 < author.time.length && Math.abs(author.time[j + 1]! - ours.time[i]!) <= Math.abs(author.time[j]! - ours.time[i]!)) j++;
    if (Math.abs(author.time[j]! - ours.time[i]!) * 86400 >= 1 || ours.mask[i] || author.mask[j]) continue;
    const a = ours.flux[i]!, b = author.flux[j]!;
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push({ time: ours.time[i]!, a, b, ea: ours.err[i]!, eb: author.err[j]! });
  }
  if (pairs.length < 3) throw new Error(`Only ${pairs.length} integrations pair.`);
  const ma = median(pairs.map(pair => pair.a)), mb = median(pairs.map(pair => pair.b));
  const a = pairs.map(pair => pair.a / ma), b = pairs.map(pair => pair.b / mb), difference = a.map((value, i) => value - b[i]!);
  const meanA = a.reduce((s, v) => s + v, 0) / a.length, meanB = b.reduce((s, v) => s + v, 0) / b.length;
  const correlation = a.reduce((s, v, i) => s + (v - meanA) * (b[i]! - meanB), 0) / Math.sqrt(a.reduce((s, v) => s + (v - meanA) ** 2, 0) * b.reduce((s, v) => s + (v - meanB) ** 2, 0));
  // Least-squares line of the difference against time.
  const times = pairs.map(pair => pair.time), meanT = times.reduce((s, v) => s + v, 0) / times.length, meanD = difference.reduce((s, v) => s + v, 0) / difference.length;
  const slope = times.reduce((s, t, i) => s + (t - meanT) * (difference[i]! - meanD), 0) / times.reduce((s, t) => s + (t - meanT) ** 2, 0);
  const detrended = difference.map((value, i) => value - meanD - slope * (times[i]! - meanT));
  return {
    paired: pairs.length, correlation,
    differencePpm: std(difference) * 1e6, detrendedDifferencePpm: std(detrended) * 1e6,
    driftPpmPerDay: slope * 1e6,
    scatterPpm: { ours: scatter(a) * 1e6, author: scatter(b) * 1e6 },
    medianErrorPpm: { ours: median(pairs.map(pair => pair.ea / ma)) * 1e6, author: median(pairs.map(pair => pair.eb / mb)) * 1e6 },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [oursPath, authorPath] = process.argv.slice(2);
  if (!oursPath || !authorPath) throw new TypeError('Usage: compare-light-curves <ours.csv> <author.csv>');
  const [ours, author] = await Promise.all([oursPath, authorPath].map(async path => parseLightCurve(await readFile(path, 'utf8'))));
  console.log(JSON.stringify(compareLightCurves(ours!, author!), (_, value: unknown) => typeof value === 'number' ? Math.round(value * 10000) / 10000 : value, 2));
}
