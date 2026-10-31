import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Inputs } from '../physics/types.mts';
import type { BandName, ColumnResult, IrBand, IrCube } from './types.mts';

// Offline inference only. All image values are calibrated MJy/sr; NH is cm^-2.
const NUNIT = 1e20;
const NFLOOR = .02 * 3.1 / (1.086 * 4.983382167689161e-22) / NUNIT;
const P0_MW60 = 4.558e-24; // DL07 total erg/s/H at U=1, not a band emissivity.
const HGRID = [.25, .5, 1, 2, 4];
const FINE: readonly BandName[] = ['WISE3', 'WISE4', 'MIPS24'];
const NAMES: readonly BandName[] = [...FINE, 'MIPS70'];
const REL = [.20, .15, .15, .30];
const FLOOR = [.02, .02, .02, .30];
const CELL = 32, HOLDOUT = 128, SAMPLE = 4;
const KEY = ['WISE3flatFnu', 'WISE4flatFnu', 'MIPS24', 'MIPS70'];

type Template = { model: string; q: number; logU: Float64Array; e: Float64Array[]; power0: number };
type Point = { x: number; y: number; tanX: number; tanY: number; train: boolean; n0: number; values: number[]; variances: number[]; counts: number[]; samples: number[] };
type Observation = { y: number; variance: number; e: number; band: number };
type Fit = { n: number; variance: number; count: number };
type Candidate = { h: number; template: Template; e: Float64Array; offsets: number[]; offsetScatter: number[];
  slopesX: number[]; slopesY: number[]; backgroundFitsValid: boolean;
  trainScore: number; trainCount: number; validationScore: number; validationCount: number; bandScores: number[] };
type BackgroundModel = 'constant' | 'plane';
type PlaneFit = { coefficients: number[]; scatter: number; valid: boolean; points: number };

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value)); return Object.fromEntries(Object.entries(value));
}
function number(value: unknown): number { assert.ok(typeof value === 'number' && Number.isFinite(value)); return value; }
function array(value: unknown): unknown[] { assert.ok(Array.isArray(value)); return value; }
function text(value: unknown): string { assert.ok(typeof value === 'string'); return value; }
function median(values: number[]): number {
  if (!values.length) return NaN;
  values.sort((a, b) => a - b); const mid = values.length >> 1;
  return values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) * .5;
}
function robustLocation(values: number[]): { center: number; scatter: number } {
  const center = median([...values]);
  return { center, scatter: 1.4826 * median(values.map(v => Math.abs(v - center))) };
}
const finiteOrNull = (v: number): number | null => Number.isFinite(v) ? v : null;
const failsColor = (meanScore: number, bandMedianScores: number[]): boolean =>
  meanScore > 4 || bandMedianScores.some(score => Number.isFinite(score) && score > 4);

function tanPixel(cube: IrCube, x: number, y: number): [number, number] {
  const h = cube.header, get = (key: string, fallback: number): number => typeof h[key] === 'number' ? number(h[key]) : fallback;
  const dx = x + 1 - get('CRPIX1', (cube.width + 1) * .5), dy = y + 1 - get('CRPIX2', (cube.height + 1) * .5);
  return [get('CD1_1', get('CDELT1', -3 / 3600)) * dx + get('CD1_2', 0) * dy,
    get('CD2_1', 0) * dx + get('CD2_2', get('CDELT2', 3 / 3600)) * dy];
}
function solve3(matrix: number[][], rhs: number[]): number[] | undefined {
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return undefined;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!]; const scale = a[col]![col]!;
    for (let j = col; j < 4; j++) a[col]![j]! /= scale;
    for (let row = 0; row < 3; row++) if (row !== col) {
      const multiplier = a[row]![col]!;
      for (let j = col; j < 4; j++) a[row]![j]! -= multiplier * a[col]![j]!;
    }
  }
  return a.map(row => row[3]!);
}
function robustPlane(rows: Array<{ x: number; y: number; value: number }>, mode: BackgroundModel, floor: number): PlaneFit {
  const location = robustLocation(rows.map(row => row.value));
  if (mode === 'constant') return { coefficients: [location.center, 0, 0], scatter: location.scatter, valid: rows.length > 0, points: rows.length };
  let beta = [location.center, 0, 0];
  if (rows.length < 6) return { coefficients: beta, scatter: location.scatter, valid: false, points: rows.length };
  // A fixed six-step Huber IRLS solve is the single plane trial, not a new local fit.
  for (let iteration = 0; iteration < 6; iteration++) {
    const residuals = rows.map(row => row.value - beta[0]! - beta[1]! * row.x - beta[2]! * row.y);
    const scale = Math.max(floor, robustLocation(residuals).scatter), matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rhs = [0, 0, 0];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!, basis = [1, row.x, row.y], weight = Math.min(1, 1.345 * scale / Math.max(Math.abs(residuals[i]!), 1e-30));
      for (let a = 0; a < 3; a++) {
        rhs[a]! += weight * basis[a]! * row.value;
        for (let b = 0; b < 3; b++) matrix[a]![b]! += weight * basis[a]! * basis[b]!;
      }
    }
    const next = solve3(matrix, rhs);
    if (!next || !next.every(Number.isFinite)) return { coefficients: beta, scatter: scale, valid: false, points: rows.length };
    beta = next;
  }
  const scatter = robustLocation(rows.map(row => row.value - beta[0]! - beta[1]! * row.x - beta[2]! * row.y)).scatter;
  return { coefficients: beta, scatter, valid: true, points: rows.length };
}

let templatePromise: Promise<Template[]> | undefined;
async function templates(): Promise<Template[]> {
  templatePromise ??= (async () => {
    const raw: unknown = JSON.parse(await readFile('.local/infrared/heating/emissivity-grid.json', 'utf8'));
    const root = object(raw); assert.equal(root.schema, 'pleiades-dl07-ir-emissivity@1');
    assert.equal(root.jNuUnit, 'Jy cm2 sr-1 H-1');
    const models = new Map<string, Array<{ U: number; q: number; e: number[]; power: number }>>();
    for (const value of array(root.rows)) {
      const row = object(value), name = text(row.model), U = number(row.U), q = number(row.qPahPercent);
      const bands = object(row.jNuJyCm2SrPerH);
      const e = KEY.map(key => number(bands[key]) * 1e14); // MJy/sr per 1e20 H/cm².
      assert.ok(U > 0 && e.every(v => v > 0));
      const rows = models.get(name) ?? []; rows.push({ U, q, e, power: number(row.powerErgPerSecPerH) }); models.set(name, rows);
    }
    const result: Template[] = [];
    for (const [model, rows] of models) {
      rows.sort((a, b) => a.U - b.U);
      assert.ok(rows.length >= 10 && rows.every((r, i) => i === 0 || r.U > rows[i - 1]!.U));
      const u1 = rows.find(row => row.U === 1); assert.ok(u1, 'Missing U=1 absorbed-power normalization');
      result.push({ model, q: u1.q, power0: u1.power, logU: Float64Array.from(rows, r => Math.log(r.U)),
        e: KEY.map((_, band) => Float64Array.from(rows, r => Math.log(r.e[band]!))) });
    }
    assert.equal(result.length, 3); return result.sort((a, b) => a.q - b.q);
  })();
  return templatePromise;
}
function bracket(t: Template, U: number): { lo: number; f: number; clamped: boolean } {
  const l = Math.log(Math.max(U, Number.MIN_VALUE)), last = t.logU.length - 1;
  if (l <= t.logU[0]!) return { lo: 0, f: 0, clamped: l < t.logU[0]! };
  if (l >= t.logU[last]!) return { lo: last - 1, f: 1, clamped: l > t.logU[last]! };
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t.logU[mid]! <= l) lo = mid; else hi = mid; }
  return { lo, f: (l - t.logU[lo]!) / (t.logU[hi]! - t.logU[lo]!), clamped: false };
}
function coefficients(out: Float64Array, cube: IrCube, p: number, h: number, t: Template): boolean {
  if (cube.heatingNodes) {
    out.fill(0); let clamped=false;
    const ratio=P0_MW60/t.power0,fraction=Math.max(0,Math.min(1,cube.fcoarse[p]!));
    for(let layer=0;layer<2;layer++)for(let node=0;node<cube.heatingNodes.weights.length;node++){
      const U=cube.heatingNodes.layers[layer]![node]![p]!*ratio;
      const a=bracket(t,1+h*U),weight=(layer===0?1-fraction:fraction)*cube.heatingNodes.weights[node]!*(1+U)/(1+h*U);
      clamped ||= a.clamped;
      for(let band=0;band<4;band++){const v=t.e[band]!;out[band]!+=weight*Math.exp(v[a.lo]!*(1-a.f)+v[a.lo+1]!*a.f);}
    }
    return clamped;
  }
  const ratio = P0_MW60 / t.power0, a = bracket(t, 1 + h * cube.Ustar0[p]! * ratio), b = bracket(t, 1 + h * cube.Ustar1[p]! * ratio);
  const fraction = Math.max(0, Math.min(1, cube.fcoarse[p]!));
  // h changes the template's spectral shape, not the supplied stellar absorbed energy.
  // DL07 total power is proportional to U. Renormalize each layer separately to its
  // physically computed absorbed power; this is a declared hardness-shape approximation.
  const power0 = (1 + cube.Ustar0[p]! * ratio) / (1 + h * cube.Ustar0[p]! * ratio);
  const power1 = (1 + cube.Ustar1[p]! * ratio) / (1 + h * cube.Ustar1[p]! * ratio);
  for (let band = 0; band < 4; band++) {
    const v = t.e[band]!;
    out[band] = (1 - fraction) * power0 * Math.exp(v[a.lo]! * (1 - a.f) + v[a.lo + 1]! * a.f)
      + fraction * power1 * Math.exp(v[b.lo]! * (1 - b.f) + v[b.lo + 1]! * b.f);
  }
  return a.clamped || b.clamped;
}
function geometryValid(cube: IrCube, p: number): boolean {
  return Number.isFinite(cube.NHprior[p]) && cube.NHprior[p]! >= 0 && Number.isFinite(cube.fcoarse[p])
    && Number.isFinite(cube.Ustar0[p]) && cube.Ustar0[p]! >= 0 && Number.isFinite(cube.Ustar1[p]) && cube.Ustar1[p]! >= 0;
}
function usable(data: Float32Array, variance: Float32Array, validity: Uint8Array, p: number): boolean {
  return validity[p]! > 0 && Number.isFinite(data[p]) && Number.isFinite(variance[p]) && variance[p]! >= 0;
}
function effectiveVariance(variance: number, correctedBrightness: number, band: number): number {
  return Math.max(0, variance) + FLOOR[band]! ** 2 + (REL[band]! * Math.abs(correctedBrightness)) ** 2;
}
function infer(observations: Observation[], n0: number, excludedBand = -1): Fit {
  const priorWeight = Number.isFinite(n0) ? 1 / (n0 * n0 + NFLOOR * NFLOOR) : 0;
  let numerator = priorWeight * (Number.isFinite(n0) ? n0 : 0), denominator = priorWeight, count = 0;
  for (const obs of observations) {
    if (obs.band === excludedBand) continue;
    const weight = 1 / effectiveVariance(obs.variance, obs.y, obs.band);
    numerator += weight * obs.e * obs.y; denominator += weight * obs.e * obs.e; count++;
  }
  return { n: denominator > 0 ? Math.max(0, numerator / denominator) : NaN, variance: denominator > 0 ? 1 / denominator : Infinity, count };
}
function observations(point: Point, e: Float64Array, offset: number, backgrounds: number[], slopesX: number[], slopesY: number[]): Observation[] {
  const out: Observation[] = [];
  for (let b = 0; b < 3; b++) if (point.counts[b]! > 0 && Number.isFinite(backgrounds[b])) {
    out.push({ band: b, y: point.values[b]! - backgrounds[b]! - slopesX[b]! * point.tanX - slopesY[b]! * point.tanY, variance: point.variances[b]!, e: e[offset + b]! });
  }
  return out;
}
function scores(points: Point[], e: Float64Array, backgrounds: number[], slopesX: number[], slopesY: number[], train: boolean): { score: number; count: number; perBand: number[] } {
  const values: number[] = [], bandValues: number[][] = [[], [], []];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!; if (p.train !== train) continue;
    const obs = observations(p, e, i * 4, backgrounds, slopesX, slopesY); if (obs.length < 3) continue;
    for (const held of obs) {
      const fitted = infer(obs, p.n0, held.band);
      const variance = effectiveVariance(held.variance, held.y, held.band) + held.e ** 2 * fitted.variance;
      const z2 = (held.y - fitted.n * held.e) ** 2 / variance;
      values.push(z2); bandValues[held.band]!.push(z2);
    }
  }
  // A 10% upper trim limits unmasked artifacts; diagnostics retain band medians.
  values.sort((a, b) => a - b); const keep = Math.ceil(values.length * .9);
  const score = keep ? values.slice(0, keep).reduce((s, v) => s + v, 0) / keep : Infinity;
  return { score, count: values.length, perBand: bandValues.map(v => median(v)) };
}
function coarsePoints(cube: IrCube, bands: IrBand[]): Point[] {
  const out: Point[] = [], { width, height } = cube;
  for (let y = 0; y < height; y += CELL) for (let x = 0; x < width; x += CELL) {
    const sum = [0, 0, 0, 0], variance = [0, 0, 0, 0], counts = [0, 0, 0, 0], samples: number[] = [];
    let prior = 0, priorCount = 0;
    for (let j = y; j < Math.min(height, y + CELL); j++) for (let i = x; i < Math.min(width, x + CELL); i++) {
      const p = j * width + i; if (!geometryValid(cube, p)) continue;
      prior += cube.NHprior[p]! / NUNIT; priorCount++;
      if ((j - y) % SAMPLE === Math.min(2, height - y - 1) && (i - x) % SAMPLE === Math.min(2, width - x - 1)) samples.push(p);
      for (let b = 0; b < 4; b++) {
        const band = bands[b]!, data = b === 3 ? band.coarseData : band.data;
        const vari = b === 3 ? band.coarseVariance : band.variance, mask = b === 3 ? band.coarseValidity : band.validity;
        if (!data || !vari || !mask || !usable(data, vari, mask, p)) continue;
        sum[b]! += data[p]!; variance[b]! += vari[p]!; counts[b]!++;
      }
    }
    if (!priorCount || !samples.length) continue;
    const minimum = Math.min(32, Math.ceil(priorCount * .125));
    for (let b = 0; b < 4; b++) if (counts[b]! < minimum) counts[b] = 0;
    const hash = (Math.floor(x / HOLDOUT) * 17 + Math.floor(y / HOLDOUT) * 31) % 4;
    const [tanX, tanY] = tanPixel(cube, x + (Math.min(width, x + CELL) - x - 1) * .5, y + (Math.min(height, y + CELL) - y - 1) * .5);
    out.push({ x: x / CELL, y: y / CELL, tanX, tanY, train: hash !== 0, n0: prior / priorCount,
      values: sum.map((s, b) => counts[b]! ? s / counts[b]! : NaN),
      variances: variance.map((s, b) => counts[b]! ? s / counts[b]! ** 2 : Infinity), counts, samples });
  }
  return out;
}
function candidate(points: Point[], cube: IrCube, h: number, template: Template, mode: BackgroundModel): Candidate {
  const e = new Float64Array(points.length * 4), temp = new Float64Array(4), residuals: Array<Array<{ x: number; y: number; value: number }>> = [[], [], []];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, plain = [0, 0, 0, 0]; let priorWeight = 0;
    for (const pixel of p.samples) {
      coefficients(temp, cube, pixel, h, template); const n = cube.NHprior[pixel]! / NUNIT;
      priorWeight += n;
      for (let b = 0; b < 4; b++) { e[i * 4 + b]! += temp[b]! * n; plain[b]! += temp[b]!; }
    }
    for (let b = 0; b < 4; b++) {
      e[i * 4 + b] = priorWeight > 0 ? e[i * 4 + b]! / priorWeight : plain[b]! / p.samples.length;
      // MIPS70 is never an offset/selection input at the fine-model stage.
      if (b < 3 && p.train && p.counts[b]! > 0) residuals[b]!.push({ x: p.tanX, y: p.tanY, value: p.values[b]! - p.n0 * e[i * 4 + b]! });
    }
  }
  const locations = residuals.map((v, b) => robustPlane(v, mode, FLOOR[b]!));
  const offsets = locations.map(v => v.coefficients[0]!), offsetScatter = locations.map(v => v.scatter);
  const slopesX = locations.map(v => v.coefficients[1]!), slopesY = locations.map(v => v.coefficients[2]!);
  const train = scores(points, e, offsets, slopesX, slopesY, true), validation = scores(points, e, offsets, slopesX, slopesY, false);
  return { h, template, e, offsets, offsetScatter, slopesX, slopesY, backgroundFitsValid: locations.every(v => v.valid), trainScore: train.score, trainCount: train.count,
    validationScore: validation.score, validationCount: validation.count, bandScores: validation.perBand };
}
function smoothCoarse(points: Point[], values: number[], pixelArcsec: number): number[] {
  const sigma = 180 / 2.354820045 / (CELL * pixelArcsec), radius = Math.ceil(3 * sigma);
  const lookup = new Map(points.map((p, i) => [`${p.x},${p.y}`, i]));
  return points.map(p => {
    let sum = 0, weight = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const i = lookup.get(`${p.x + dx},${p.y + dy}`); if (i === undefined || !Number.isFinite(values[i])) continue;
      const w = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)); sum += w * values[i]!; weight += w;
    }
    return weight > 0 ? sum / weight : NaN;
  });
}
function check70(points: Point[], chosen: Candidate, pixelArcsec: number): Record<string, unknown> {
  const priorPrediction = smoothCoarse(points, points.map((p, i) => p.n0 * chosen.e[i * 4 + 3]!), pixelArcsec);
  const offset = robustLocation(points.flatMap((p, i) => p.train && p.counts[3]! > 0 && Number.isFinite(priorPrediction[i])
    ? [p.values[3]! - priorPrediction[i]!] : []));
  if (!Number.isFinite(offset.center)) return { status: 'unavailable', reason: 'No supplied 180-arcsec MIPS70 crosscheck arrays; striped native data excluded.' };
  const inferred = points.map((p, i) => infer(observations(p, chosen.e, i * 4, chosen.offsets, chosen.slopesX, chosen.slopesY), p.n0).n * chosen.e[i * 4 + 3]!);
  const predicted = smoothCoarse(points, inferred, pixelArcsec), z2: number[] = [], fractional: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!; if (p.train || !p.counts[3] || !Number.isFinite(predicted[i])) continue;
    const y = p.values[3]! - offset.center, residual = y - predicted[i]!;
    z2.push(residual * residual / effectiveVariance(p.variances[3]!, y, 3));
    if (Math.abs(y) > 3 * FLOOR[3]!) fractional.push(residual / Math.abs(y));
  }
  return { status: z2.length >= 8 ? 'crosscheck-only' : 'insufficient-coverage', nativeFineDataUsed: false,
    backgroundMJySr: offset.center, backgroundResidualScatterMJySr: offset.scatter, heldOutSamples: z2.length,
    medianNormalizedResidualSquared: finiteOrNull(median(z2)), medianFractionalResidual: finiteOrNull(median(fractional)),
    modelSmoothingFwhmArcsec: 180, systematicFraction: REL[3], usedForParameterSelection: false };
}

export async function fitColumn(data: IrCube, inputs: Inputs, options: { backgroundModel?: BackgroundModel } = {}): Promise<ColumnResult> {
  const backgroundModel = options.backgroundModel ?? 'plane';
  const began = performance.now(), { width, height } = data, size = width * height;
  assert.ok(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0);
  assert.ok(inputs.stars.length > 0, 'Missing parent stellar heating inputs');
  for (const field of [data.NHprior, data.Ustar0, data.Ustar1, data.fcoarse]) assert.equal(field.length, size);
  if(data.heatingNodes){assert.ok(Math.abs(data.heatingNodes.weights.reduce((a,b)=>a+b,0)-1)<1e-8);for(const layer of data.heatingNodes.layers){assert.equal(layer.length,data.heatingNodes.weights.length);for(const node of layer){assert.equal(node.length,size);assert.ok(node.every(v=>Number.isFinite(v)&&v>=0));}}}
  const bands = NAMES.map(name => { const found = data.bands.filter(b => b.name === name); assert.equal(found.length, 1, `Missing/duplicate ${name}`); return found[0]!; });
  for (const band of bands) for (const field of [band.data, band.variance, band.validity, band.coarseData, band.coarseVariance, band.coarseValidity]) if (field) assert.equal(field.length, size);
  const grid = await templates(), points = coarsePoints(data, bands), candidates: Candidate[] = [];
  for (const template of grid) for (const h of HGRID) candidates.push(candidate(points, data, h, template, backgroundModel));
  // Select on training IR colors only; held-out scores never choose a candidate.
  candidates.sort((a, b) => a.trainScore - b.trainScore || Math.abs(Math.log(a.h)) - Math.abs(Math.log(b.h)) || b.template.q - a.template.q);
  const chosen = candidates[0]!;
  const NH = new Float32Array(size), validity = new Uint8Array(size), e = new Float64Array(4);
  let priorOnly = 0, unknown = 0, irPixels = 0, singleBandPixels = 0, clamped = 0;
  const bandCounts = [0, 0, 0];
  for (let p = 0; p < size; p++) {
    if (!geometryValid(data, p)) { NH[p] = Number.isFinite(data.NHprior[p]) && data.NHprior[p]! >= 0 ? data.NHprior[p]! : NaN; priorOnly++; unknown++; continue; }
    const n0 = data.NHprior[p]! / NUNIT;
    if (coefficients(e, data, p, chosen.h, chosen.template)) clamped++;
    const obs: Observation[] = [], [tanX, tanY] = backgroundModel === 'plane' ? tanPixel(data, p % width, Math.floor(p / width)) : [0, 0];
    for (let b = 0; b < 3; b++) {
      const band = bands[b]!; if (!usable(band.data, band.variance, band.validity, p) || !Number.isFinite(chosen.offsets[b])) continue;
      const background = chosen.offsets[b]! + chosen.slopesX[b]! * tanX + chosen.slopesY[b]! * tanY;
      obs.push({ band: b, y: band.data[p]! - background, variance: band.variance[p]!, e: e[b]! }); bandCounts[b]!++;
    }
    if (!obs.length) { NH[p] = data.NHprior[p]!; priorOnly++; continue; }
    NH[p] = infer(obs, n0).n * NUNIT; validity[p] = 1; irPixels++;
    if (obs.length === 1) singleBandPixels++;
  }
  const insufficient = chosen.trainCount < 24 || chosen.validationCount < 24;
  const colorFailure = !insufficient && failsColor(chosen.validationScore, chosen.bandScores);
  const pixelArcsec = (() => {
    const cd11 = data.header.CD1_1, cd21 = data.header.CD2_1, cdelt = data.header.CDELT1;
    if (typeof cd11 === 'number' && typeof cd21 === 'number') return Math.hypot(cd11, cd21) * 3600;
    if (typeof cdelt === 'number') return Math.abs(cdelt) * 3600;
    return 3;
  })();
  return { NH, validity, metadata: {
    schema: 'pleiades-ir-column-fit@1', status: insufficient ? 'insufficient-ir-color-coverage' : colorFailure ? 'ir-color-model-failure' : 'conditionally-constrained',
    recommendedForColumnUse: !insufficient && !colorFailure && clamped === 0 && chosen.backgroundFitsValid, colorModelFailure: colorFailure,
    physicalMeaning: 'IR-constrained beam-averaged column on frozen conditional Pleiades depth/layer prior; not uniquely measured 3D dust.',
    heatingIntegration:data.heatingNodes?{method:'Dust-mass quadrature of emissivities, with spectrally integrated direct-beam UV/optical shielding',nodesPerLayer:data.heatingNodes.weights.length,weights:data.heatingNodes.weights}:{method:'Unattenuated direct stellar heating at each layer mean; sensitivity control only'},
    NHunit: 'H nucleons cm-2', inputSurfaceBrightnessUnit: 'MJy sr-1', pixelArcsec,
    selected: { hU: chosen.h, qPahPercent: chosen.template.q, model: chosen.template.model, Ubackground: 1,
      qNormalization: 'parent MW3.1_60 excess U multiplied by P0_MW60/P0_q', power0ErgPerSecPerH: chosen.template.power0,
      hUMeaning: 'energy-normalized spectral-shape coordinate, not extra stellar power',
      energyNormalization: 'each layer j(Ushape) multiplied by Uphysical/Ushape; Uphysical=1+Ustar*P0_MW60/P0_q',
      shapeApproximation: 'scaled MMP83 template shape is not a calculation of B-star stochastic heating' },
    backgroundsMJySr: Object.fromEntries(FINE.map((name, b) => [name, finiteOrNull(chosen.offsets[b]!)])),
    backgroundResidualScatterMJySr: Object.fromEntries(FINE.map((name, b) => [name, finiteOrNull(chosen.offsetScatter[b]!)])),
    backgroundModel,
    backgroundPlanes: Object.fromEntries(FINE.map((name, b) => {
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
        const [tx, ty] = tanPixel(data, x!, y!); return chosen.offsets[b]! + chosen.slopesX[b]! * tx + chosen.slopesY[b]! * ty;
      });
      const rawPlane = robustPlane(points.flatMap(p => p.train && p.counts[b]! > 0 ? [{ x: p.tanX, y: p.tanY, value: p.values[b]! }] : []), 'plane', FLOOR[b]!);
      return [name, { offsetMJySr: finiteOrNull(chosen.offsets[b]!), gradientTanXMJySrPerDegree: chosen.slopesX[b], gradientTanYMJySrPerDegree: chosen.slopesY[b],
        rangeAcrossGridMJySr: [Math.min(...corners), Math.max(...corners)], peakToPeakMJySr: Math.max(...corners) - Math.min(...corners),
        rawTrainingImagePlane: { offsetMJySr: finiteOrNull(rawPlane.coefficients[0]!), gradientTanXMJySrPerDegree: rawPlane.coefficients[1], gradientTanYMJySrPerDegree: rawPlane.coefficients[2] } }];
    })),
    backgroundCoordinate: 'FITS TAN intermediate x/y degrees relative to CRVAL; nine global additive coefficients for plane mode; no local gains',
    backgroundMethod: backgroundModel === 'plane' ? 'train-only six-step Huber robust plane fit to coarse I-NHprior*emissivity; one offset plus TAN x/y slope per fine band; unchanged overlap correction' : 'train-only coarse median(I-NHprior*emissivity); one additive offset per band after upstream overlap correction; no local gain',
    systematicFraction: Object.fromEntries(FINE.map((name, b) => [name, REL[b]])),
    absoluteFloorMJySr: Object.fromEntries(FINE.map((name, b) => [name, FLOOR[b]])),
    weighting: 'variance + absoluteFloor^2 + (relativeSystematic*abs(I-background))^2; raw zodiacal level never sets systematic weight',
    prior: { sigmaNH: 'sqrt(NHprior^2 + floorNH^2)', floorNH: NFLOOR * NUNIT, basis: '100% column uncertainty plus adopted 0.02 mag E(B-V) floor in quadrature' },
    validation: { coarseCellPixels: CELL, modelSampleStridePixels: SAMPLE, independentHoldoutBlockPixels: HOLDOUT,
      holdout: '(17*floor(x/128)+31*floor(y/128))%4 == 0', trainSamples: chosen.trainCount,
      heldOutSamples: chosen.validationCount, statistic: 'mean leave-one-band-out standardized squared error after upper10% trim; posterior column variance propagated',
      trainingScore: finiteOrNull(chosen.trainScore), heldOutScore: finiteOrNull(chosen.validationScore), failureThreshold: 4,
      failureRule: 'held-out trimmed mean >4 OR any individual band median >4; a coherent failing band cannot hide in the mean',
      medianHeldOutSquaredErrorByBand: Object.fromEntries(FINE.map((name, b) => [name, finiteOrNull(chosen.bandScores[b]!)])),
      opticalPhotoRead: false, selectionUsesHeldOutBlocks: false },
    scan: candidates.map(v => ({ hU: v.h, qPahPercent: v.template.q, trainingScore: finiteOrNull(v.trainScore), heldOutScore: finiteOrNull(v.validationScore) })),
    nearEquivalentChoices: candidates.filter(v => v.trainScore <= chosen.trainScore * 1.05 + .01).map(v => ({ hU: v.h, qPahPercent: v.template.q })),
    pixels: { total: size, irConstrained: irPixels, singleFineBand: singleBandPixels, priorOnly, unknownGeometry: unknown, interpolationClamped: clamped,
      contributingByFineBand: Object.fromEntries(FINE.map((name, b) => [name, bandCounts[b]])), validityMeaning: '1=at least one usable fine-IR band;0=unchanged prior or unknown; unknown input prior remains NaN' },
    mips70: check70(points, chosen, pixelArcsec), frozenNormalDepthPc: { extensiveDust: 136, starNearDust: 136.4, stars: 136.7 },
    limitations: ['hU and qPAH are global effective IR calibrations; MMP83 templates do not reproduce arbitrary B-star spectral hardness.',
      'No per-pixel heating, PAH fraction, optical texture, or photometric gain is fitted.',
      '32-pixel coarse offset inference uses sparse prior-weighted emissivity samples; retain coarse-forward-model approximation uncertainty.',
      'MIPS70 native stripes do not enter the column map or parameter selection.'],
    elapsedSeconds: (performance.now() - began) / 1000,
  } };
}

export function columnFitSelfCheck(): Record<string, unknown> {
  assert.equal(effectiveVariance(.1, 1000 - 999, 0), effectiveVariance(.1, 10 - 9, 0), 'Raw zodiacal offsets must not change relative weights');
  assert.equal(infer([], 3).n, 3, 'No IR data must preserve the prior');
  assert.ok(Number.isNaN(infer([], NaN).n), 'Unknown with no data must stay unknown');
  const consistent: Observation[] = [1, 2, 4].map((e, band) => ({ band, e, y: 5 * e, variance: .001 }));
  assert.ok(Math.abs(infer(consistent, 5).n - 5) < 1e-12, 'Physical column must be recovered');
  const corrupted = consistent.map(o => ({ ...o, y: o.band === 0 ? 1000 : o.y }));
  const held = corrupted[0]!, fitted = infer(corrupted, 5, 0);
  assert.ok((held.y - fitted.n * held.e) ** 2 / (effectiveVariance(held.variance, held.y, 0) + held.e ** 2 * fitted.variance) > 4,
    'A large color failure must be detected by a held-out band');
  assert.equal(failsColor(2, [.1, .1, 5]), true, 'One coherent failing band must not hide in an acceptable overall mean');
  const planeRows = Array.from({ length: 121 }, (_, i) => { const x = (i % 11 - 5) / 10, y = (Math.floor(i / 11) - 5) / 10; return { x, y, value: 2 + 3 * x - 4 * y + (i === 0 ? 1000 : 0) }; });
  const plane = robustPlane(planeRows, 'plane', .02); assert.ok(plane.valid);
  assert.ok(plane.coefficients.every((v, i) => Math.abs(v - [2, 3, -4][i]!) < .05), 'Robust additive plane must recover known gradients despite an outlier');
  return { status: 'verified', checks: ['corrected-brightness weighting', 'missing-data prior preservation', 'unknown preservation', 'column recovery', 'held-out color failure'] };
}

export async function columnFitPrototypePilot(inputs: Inputs, backgroundModel: BackgroundModel = 'constant'): Promise<Record<string, unknown>> {
  columnFitSelfCheck();
  const width = 256, height = 256, size = width * height, truth = new Float32Array(size), NHprior = new Float32Array(size);
  const fcoarse = new Float32Array(size), Ustar0 = new Float32Array(size), Ustar1 = new Float32Array(size);
  const bands: IrBand[] = NAMES.map(name => ({ name, data: new Float32Array(size), variance: new Float32Array(size), validity: new Uint8Array(size) }));
  const cube: IrCube = { width, height, header: { CDELT1: -3 / 3600, CDELT2: 3 / 3600 }, bands, NHprior, fcoarse, Ustar0, Ustar1 };
  const template = (await templates()).find(t => t.model === 'MW3.1_60'); assert.ok(template);
  const e = new Float64Array(4), offsets = [6, 25, 30, 10], slopesX = [1, -2, 1.5, 0], slopesY = [-2, 3, .5, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, n = 3 + .5 * Math.sin(x / 5) + .5 * Math.cos(y / 7);
    truth[p] = n * NUNIT; NHprior[p] = 3 * NUNIT; fcoarse[p] = .35;
    Ustar0[p] = 5 + 35 * x / width; Ustar1[p] = 12 + 70 * y / height;
    coefficients(e, cube, p, 1, template);
    for (let b = 0; b < 4; b++) {
      const [tanX, tanY] = tanPixel(cube, x, y), gradient = backgroundModel === 'plane' ? slopesX[b]! * tanX + slopesY[b]! * tanY : 0;
      const band = bands[b]!; band.data[p] = n * e[b]! + offsets[b]! + gradient; band.variance[p] = .005 ** 2;
      // Deliberate empty/saturated patch: its true column differs from its prior.
      band.validity[p] = x >= 100 && x < 120 && y >= 100 && y < 120 ? 0 : 1;
    }
  }
  const result = await fitColumn(cube, inputs, { backgroundModel });
  let n = 0, tx = 0, rx = 0, tt = 0, rr = 0, tr = 0, noData = 0;
  for (let p = 0; p < size; p++) {
    if (!bands[0]!.validity[p]) {
      assert.equal(result.validity[p], 0); assert.equal(result.NH[p], NHprior[p]); noData++; continue;
    }
    const t = truth[p]! / NUNIT, r = result.NH[p]! / NUNIT;
    assert.ok(Number.isFinite(r) && r >= 0); n++; tx += t; rx += r; tt += t * t; rr += r * r; tr += t * r;
  }
  const correlation = (tr - tx * rx / n) / Math.sqrt((tt - tx * tx / n) * (rr - rx * rx / n));
  const recoveredScatter = Math.sqrt((rr - rx * rx / n) / n), trueScatter = Math.sqrt((tt - tx * tx / n) / n);
  assert.ok(correlation > .8 && recoveredScatter > .5 * trueScatter, 'The IR data must recover column structure absent from the prior');
  return { status: 'verified', width, height, backgroundModel, inferredPixels: n, preservedPriorOnlyPixels: noData,
    correlation, recoveredScatter, trueScatter, selected: result.metadata.selected,
    heldOut: result.metadata.validation, elapsedSeconds: result.metadata.elapsedSeconds };
}
