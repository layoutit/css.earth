import { readFileSync } from 'node:fs';
/** Mid-transit time of HD 209458 b from a JWST Level 3 white-light curve (MAST *_whtlt.ecsv; columns MJD_UTC, BJD_TDB, whitelight_flux).
 *
 *   node tools/objects/source-authoring/hd-209458/fit-transit-time.mts <whtlt.ecsv>
 *
 * A trapezoid with a linear baseline, least squares by Nelder-Mead; the error is the spread of 200 block bootstraps of the residuals. */
const file = process.argv[2]!;
const rows = readFileSync(file, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).slice(1).map(l => l.split(/\s+/).map(Number)).filter(r => r.every(Number.isFinite));
let t = rows.map(r => r[1]!), f = rows.map(r => r[2]!);
const med = [...f].sort((a, b) => a - b)[f.length >> 1]!; f = f.map(v => v / med);
// 5-sigma clip against a running median
const keep = f.map((v, i) => { const w = f.slice(Math.max(0, i - 15), i + 16).sort((a, b) => a - b); const m = w[w.length >> 1]!; return Math.abs(v - m) < 0.002; });
t = t.filter((_, i) => keep[i]); f = f.filter((_, i) => keep[i]);
const t00 = t[0]!; const x = t.map(v => v - t00);
const model = (p: number[], xi: number) => { const [t0, d, T14, T12, a, b] = p as [number, number, number, number, number, number]; const u = Math.abs(xi - t0); const half = T14 / 2, flat = half - T12;
  const dip = u >= half ? 0 : u <= flat ? d : d * (half - u) / T12; return (a + b * (xi - t0)) * (1 - dip); };
const chi = (p: number[], y: number[]) => { if (p[3]! <= 0.002 || p[3]! > p[2]! / 2 || p[2]! <= 0) return 1e9; let s = 0; for (let i = 0; i < x.length; i++) { const r = y[i]! - model(p, x[i]!); s += r * r; } return s; };
function nm(p0: number[], step: number[], y: number[]) { const n = p0.length; let sim = [p0, ...p0.map((_, i) => p0.map((v, j) => v + (i === j ? step[j]! : 0)))]; let val = sim.map(p => chi(p, y));
  for (let it = 0; it < 4000; it++) { const o = val.map((_, i) => i).sort((a, b) => val[a]! - val[b]!); sim = o.map(i => sim[i]!); val = o.map(i => val[i]!);
    const c = p0.map((_, j) => sim.slice(0, n).reduce((s, p) => s + p[j]!, 0) / n); const w = sim[n]!; const at = (k: number) => c.map((v, j) => v + k * (w[j]! - v));
    const r = at(-1), fr = chi(r, y); if (fr < val[0]!) { const e = at(-2), fe = chi(e, y); if (fe < fr) { sim[n] = e; val[n] = fe; } else { sim[n] = r; val[n] = fr; } }
    else if (fr < val[n - 1]!) { sim[n] = r; val[n] = fr; } else { const k = at(0.5), fk = chi(k, y); if (fk < val[n]!) { sim[n] = k; val[n] = fk; } else { sim = sim.map(p => p.map((v, j) => sim[0]![j]! + 0.5 * (v - sim[0]![j]!))); val = sim.map(p => chi(p, y)); } } }
  return sim[0]!; }
const span = x[x.length - 1]!;
const guess = [span / 2, 0.0146, 0.128, 0.018, 1.003, 0];
const best = nm(guess, [0.01, 0.002, 0.01, 0.004, 0.001, 0.001], f);
const res = f.map((v, i) => v - model(best, x[i]!)); const rms = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / res.length);
let seed = 12345; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const block = 50, nb = Math.floor(res.length / block), t0s: number[] = [];
for (let k = 0; k < 200; k++) { const y = f.map((_, i) => model(best, x[i]!)); for (let b = 0; b < nb; b++) { const src = Math.floor(rand() * nb); for (let j = 0; j < block; j++) y[b * block + j]! += res[src * block + j]!; } t0s.push(nm(best, [0.001, 0.0005, 0.002, 0.001, 0.0003, 0.0003], y)[0]!); }
const m = t0s.reduce((s, v) => s + v, 0) / t0s.length, sd = Math.sqrt(t0s.reduce((s, v) => s + (v - m) ** 2, 0) / (t0s.length - 1));
console.log(JSON.stringify({ file: file.split('/').pop(), points: x.length, t0_BMJD_TDB: best[0]! + t00, t0_BJD_TDB: best[0]! + t00 + 2400000.5, sigma_days: sd, sigma_seconds: sd * 86400, depth: best[1], T14_days: best[2], T12_days: best[3], rms_ppm: rms * 1e6 }, null, 1));
