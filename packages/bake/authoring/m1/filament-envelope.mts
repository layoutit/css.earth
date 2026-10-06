// Entry script: node packages/bake/authoring/m1/filament-envelope.mts <table> <km/s per arcsec> <centre east> <centre north>
/**
 * The shape of the cloud of measured points of the Crab's filaments (./filament-speeds.mts): their principal axes about
 * the expansion centre, from the second moments of the points weighted by the logarithm of their flux, and how far the
 * points reach along each. The bank's recipe takes the ellipsoid that holds 99 % of them for the nebula's smooth light.
 * A speed is turned into arcseconds along the sight line by the recipe's own factor, given here.
 */
import { readFileSync } from 'node:fs';
const [table = '', lawText = '', ceText = '', cnText = ''] = process.argv.slice(2), law = Number(lawText), ce = Number(ceText), cn = Number(cnText);
if (!table || !(law > 0) || !Number.isFinite(ce) || !Number.isFinite(cn)) throw new TypeError(`Usage: filament-envelope.mts <table> <km/s per arcsec> <centre east> <centre north>; got ${JSON.stringify(process.argv.slice(2))}.`);
const points = readFileSync(table, 'utf8').trim().split('\n').map(line => line.split(' ').map(Number)).map(([e, n, v, f]) => ({ p: [e! - ce, n! - cn, v! / law] as [number, number, number], w: Math.log10(1 + f!) }));
const total = points.reduce((s, q) => s + q.w, 0), mean = [0, 1, 2].map(a => points.reduce((s, q) => s + q.w * q.p[a]!, 0) / total), cov = [0, 1, 2].map(a => [0, 1, 2].map(b => points.reduce((s, q) => s + q.w * (q.p[a]! - mean[a]!) * (q.p[b]! - mean[b]!), 0) / total));
// Jacobi rotations for the symmetric 3 x 3.
const A = cov.map(row => [...row]), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
for (let sweep = 0; sweep < 50; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) { if (Math.abs(A[p]![q]!) < 1e-12) continue; const theta = 0.5 * Math.atan2(2 * A[p]![q]!, A[q]![q]! - A[p]![p]!), c = Math.cos(theta), s = Math.sin(theta);
  for (let k = 0; k < 3; k++) { const akp = A[k]![p]!, akq = A[k]![q]!; A[k]![p] = c * akp - s * akq; A[k]![q] = s * akp + c * akq; } for (let k = 0; k < 3; k++) { const apk = A[p]![k]!, aqk = A[q]![k]!; A[p]![k] = c * apk - s * aqk; A[q]![k] = s * apk + c * aqk; }
  for (let k = 0; k < 3; k++) { const vkp = V[k]![p]!, vkq = V[k]![q]!; V[k]![p] = c * vkp - s * vkq; V[k]![q] = s * vkp + c * vkq; } }
const axes = [0, 1, 2].map(i => ({ sigma: Math.sqrt(A[i]![i]!), dir: [V[0]![i]!, V[1]![i]!, V[2]![i]!] })).sort((a, b) => b.sigma - a.sigma);
console.log(`${points.length} points; mean offset from the expansion centre ${mean.map(v => v.toFixed(1)).join(', ')} arcsec (east, north, away)`);
for (const axis of axes) { const along = points.map(q => (q.p[0] - mean[0]!) * axis.dir[0]! + (q.p[1] - mean[1]!) * axis.dir[1]! + (q.p[2] - mean[2]!) * axis.dir[2]!).sort((a, b) => a - b), pct = (f: number) => along[Math.floor(f * (along.length - 1))]!;
  const pa = (Math.atan2(axis.dir[0]!, axis.dir[1]!) * 180 / Math.PI + 360) % 180, fromSky = Math.asin(Math.abs(axis.dir[2]!)) * 180 / Math.PI;
  console.log(`axis sigma ${axis.sigma.toFixed(1)} arcsec, direction east ${axis.dir[0]!.toFixed(3)} north ${axis.dir[1]!.toFixed(3)} away ${axis.dir[2]!.toFixed(3)} (position angle ${pa.toFixed(0)} deg on the sky, ${fromSky.toFixed(0)} deg out of its plane); points reach ${pct(0.025).toFixed(0)} to ${pct(0.975).toFixed(0)} (95 %), ${pct(0.005).toFixed(0)} to ${pct(0.995).toFixed(0)} (99 %)`); }
// Plain extents on the three fixed axes, for the bake's ellipsoid (two axes on the sky, one along the sight line).
for (const [name, pick] of [['east', 0], ['north', 1], ['sight line', 2]] as const) { const sorted = points.map(q => q.p[pick]).sort((a, b) => a - b), pct = (f: number) => sorted[Math.floor(f * (sorted.length - 1))]!; console.log(`${name}: ${pct(0.01).toFixed(0)} to ${pct(0.99).toFixed(0)} (98 %), ${pct(0.001).toFixed(0)} to ${pct(0.999).toFixed(0)} (99.8 %)`); }
const radii = points.map(q => Math.hypot(...q.p)).sort((a, b) => a - b); console.log(`distance from the expansion centre: 1 % within ${radii[Math.floor(0.01 * radii.length)]!.toFixed(0)}, half within ${radii[radii.length >> 1]!.toFixed(0)}, 99 % within ${radii[Math.floor(0.99 * radii.length)]!.toFixed(0)}, all within ${radii.at(-1)!.toFixed(0)} arcsec`);
