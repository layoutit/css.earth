#!/usr/bin/env node
/** Band-parameter maps from Dawn VIR IR calibrated cubes, reduced here from the archive.
 *
 *   node tools/objects/dawn/vir-mosaic.mts reduce <recipe.json> --work <directory> [--parallel <n>] [--limit <n>] [--only <product,...>]
 *   node tools/objects/dawn/vir-mosaic.mts stripes <recipe.json> --work <directory>
 *   node tools/objects/dawn/vir-mosaic.mts phase <recipe.json> --work <directory>
 *   node tools/objects/dawn/vir-mosaic.mts mosaic <recipe.json> --work <directory>
 *
 * `reduce` streams each cube the recipe selects from the PDS volume indexes (spectral cube, wavelength cube, per-line
 * housekeeping table), derives each line's camera from the Dawn kernels (the spacecraft CK and the VIR scan-mirror CK),
 * intersects every pixel with the body's ellipsoid, converts radiance to I/F with the archive's solar spectrum, and keeps
 * only the bands the parameters read plus the geometry. The cube is then deleted; about a tenth of it stays in the work
 * directory. `stripes` measures the systematic column pattern (Carrozzo et al. 2016, "systematic vertical stripes") as
 * each (band, sample)'s median ratio to its neighbouring samples over every reduced cube. `mosaic` applies it, computes
 * the band parameters of the recipe (continua and band depths as Frigeri et al. 2019, Section 3.1, define them), keeps
 * pixels inside the incidence and emission limits and averages overlapping values per map cell, as Frigeri et al. did.
 * Output: one PDS3 float map per parameter with a detached label, as `pds3-float-map` reads it, and a receipt.
 *
 * Byte order is measured, not taken from the labels: the spectral cubes are big-endian and the wavelength cubes
 * little-endian although both labels say IEEE_REAL. */
import { sha256 } from '../../../src/platform/sha256.mts';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { loadKernelSet, type KernelSet } from '../../spice/kernel-set.mts';
import { kernelBankPaths } from '../../spice/kernel-bank.mts';
import { numbers } from '../../spice/text-kernel.mts';
import { encodeClock, clockToEt } from '../../spice/sclk.mts';
import { spiceCamera, type PixelModelKeys } from '../../spice/camera.mts';
import { pds3Keyword } from '../pds-labels.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { flagValue, positionalArguments } from '../../cli-arguments.mts';

export const RECIPE_SCHEMA = 'cssearth-vir-mosaic@1';
const REDUCED_SCHEMA = 'cssearth-vir-reduced@1';

export interface Continuum { readonly left: readonly [number, number]; readonly right: readonly [number, number] }
export interface BandParameter { readonly id: string; readonly continuum: Continuum; readonly productId: string; readonly image: string; readonly label: string }
/** `fill` phases only contribute where no `primary` phase saw a cell (Frigeri et al. fill HAMO gaps with Survey this way). */
export interface VirPhase { readonly volume: string; readonly role: 'primary' | 'fill'; readonly kernels: readonly string[]; readonly cubes: readonly string[] }
export interface VirRecipe {
  readonly schema: typeof RECIPE_SCHEMA; readonly archive: string; readonly kernelSet: string; readonly commonKernels: readonly string[];
  readonly target: { readonly name: string; readonly naifId: number; readonly bodyFrame: string; readonly referenceRadiusKm: number };
  readonly instrument: { readonly naifId: number; readonly spacecraft: number; readonly pixels: PixelModelKeys };
  readonly phases: readonly VirPhase[];
  readonly bands: { readonly boxcar: number; readonly range: readonly [number, number] };
  readonly policy: { readonly maximumIncidenceDegrees: number; readonly maximumEmissionDegrees: number; readonly stripeNeighbours: number; readonly minimumCellCount: number; readonly minimumGain: number; readonly maximumQuadKm: number; readonly destripeNeighbours: number; readonly minimumColumnPixels: number; readonly maximumColumnGap: number; readonly equalizePixelsPerDegree: number; readonly minimumOverlapCells: number; readonly referencePhaseDegrees: number; readonly outlierModifiedZ: number; readonly seamBoxCells: number };
  readonly output: { readonly pixelsPerDegree: number; readonly latitudeLimitDegrees: number; readonly dataSetId: string; readonly receipt: string };
  readonly parameters: readonly BandParameter[];
}

const pair = (value: unknown, label: string): [number, number] => {
  const list = requireArray(value, label).map((v, i) => requireFiniteNumber(v, `${label}[${i}]`));
  if (list.length !== 2 || !(list[0] <= list[1])) throw new Error(`${label} must be an increasing pair.`);
  return [list[0], list[1]];
};
const strings = (v: unknown, what: string) => requireArray(v, what).map((s, i) => requireString(s, `${what}[${i}]`));

export function parseRecipe(value: unknown): VirRecipe {
  const r = requireRecord(value, 'VIR mosaic recipe');
  if (r.schema !== RECIPE_SCHEMA) throw new Error(`VIR mosaic recipe schema must be ${RECIPE_SCHEMA}.`);
  const n = (record: Record<string, unknown>, key: string) => requireFiniteNumber(record[key], key);
  const target = requireRecord(r.target, 'target'), instrument = requireRecord(r.instrument, 'instrument'), pixels = requireRecord(instrument.pixels, 'pixels');
  const bands = requireRecord(r.bands, 'bands'), policy = requireRecord(r.policy, 'policy'), output = requireRecord(r.output, 'output');
  const focal = requireRecord(pixels.focalLength, 'focalLength'), pitch = requireRecord(pixels.pixelPitch, 'pixelPitch');
  if (focal.unit !== 'mm' || (pitch.unit !== 'micrometre' && pitch.unit !== 'mm')) throw new Error('Unsupported pixel model units.');
  const origin = n(pixels, 'origin');
  if (origin !== 0 && origin !== 1) throw new Error('pixels.origin must be 0 or 1.');
  return {
    schema: RECIPE_SCHEMA, archive: requireString(r.archive, 'archive'), kernelSet: requireString(r.kernelSet, 'kernelSet'), commonKernels: strings(r.commonKernels, 'commonKernels'),
    target: { name: requireString(target.name, 'target.name'), naifId: n(target, 'naifId'), bodyFrame: requireString(target.bodyFrame, 'target.bodyFrame'), referenceRadiusKm: n(target, 'referenceRadiusKm') },
    instrument: { naifId: n(instrument, 'naifId'), spacecraft: n(instrument, 'spacecraft'), pixels: {
      focalLength: { key: requireString(focal.key, 'focalLength.key'), unit: 'mm' }, pixelPitch: { key: requireString(pitch.key, 'pixelPitch.key'), unit: pitch.unit === 'mm' ? 'mm' : 'micrometre' },
      center: requireString(pixels.center, 'center'), boresight: requireString(pixels.boresight, 'boresight'), samples: requireString(pixels.samples, 'samples'),
      lines: requireString(pixels.lines, 'lines'), frame: requireString(pixels.frame, 'frame'), origin, column: requireString(pixels.column, 'column'), row: requireString(pixels.row, 'row') } },
    phases: requireArray(r.phases, 'phases').map((p, i) => { const phase = requireRecord(p, `phase ${i}`), role = phase.role ?? 'primary';
      if (role !== 'primary' && role !== 'fill') throw new Error(`phase ${i}: role must be primary or fill.`);
      return { volume: requireString(phase.volume, 'volume'), role, kernels: strings(phase.kernels, 'kernels'), cubes: strings(phase.cubes, 'cubes') }; }),
    bands: { boxcar: n(bands, 'boxcar'), range: pair(bands.range, 'bands.range') },
    policy: { maximumIncidenceDegrees: n(policy, 'maximumIncidenceDegrees'), maximumEmissionDegrees: n(policy, 'maximumEmissionDegrees'), stripeNeighbours: n(policy, 'stripeNeighbours'), minimumCellCount: n(policy, 'minimumCellCount'), minimumGain: n(policy, 'minimumGain'), maximumQuadKm: n(policy, 'maximumQuadKm'), destripeNeighbours: n(policy, 'destripeNeighbours'), minimumColumnPixels: n(policy, 'minimumColumnPixels'), maximumColumnGap: n(policy, 'maximumColumnGap'), equalizePixelsPerDegree: n(policy, 'equalizePixelsPerDegree'), minimumOverlapCells: n(policy, 'minimumOverlapCells'), referencePhaseDegrees: n(policy, 'referencePhaseDegrees'), outlierModifiedZ: n(policy, 'outlierModifiedZ'), seamBoxCells: n(policy, 'seamBoxCells') },
    output: { pixelsPerDegree: n(output, 'pixelsPerDegree'), latitudeLimitDegrees: n(output, 'latitudeLimitDegrees'), dataSetId: requireString(output.dataSetId, 'dataSetId'), receipt: requireString(output.receipt, 'receipt') },
    parameters: requireArray(r.parameters, 'parameters').map((p, i) => {
      const parameter = requireRecord(p, `parameter ${i}`), continuum = requireRecord(parameter.continuum, 'continuum');
      return { id: requireString(parameter.id, 'id'), productId: requireString(parameter.productId, 'productId'), image: requireString(parameter.image, 'image'), label: requireString(parameter.label, 'label'),
        continuum: { left: pair(continuum.left, 'continuum.left'), right: pair(continuum.right, 'continuum.right') } };
    }),
  };
}

async function download(url: string) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) }).catch(error => ({ ok: false, status: String(error) }) as const);
    if (response.ok && 'arrayBuffer' in response) return Buffer.from(await response.arrayBuffer());
    if (attempt >= 3) throw new Error(`${url}: ${'status' in response ? response.status : 'failed'}`);
  }
}

/** One cube's kept bands and geometry. Records are per pixel: lat, lon, cos(incidence), cos(emission), then I/F per kept band. */
interface Reduced { schema: typeof REDUCED_SCHEMA; product: string; volume: string; sha256: string; lines: number; samples: number; wavelengths: number[][]; kept: number[]; records: number }

/** Stream one cube, reduce it, and write `<product>.json` (header) and `<product>.f32` (records) to the work directory. */
async function reduceCube(recipe: VirRecipe, phase: VirPhase, path: string, set: KernelSet, sun: number[], work: string): Promise<Reduced | null> {
  const base = `${recipe.archive}/${phase.volume}${path.replace(/_1\.LBL$/u, '')}`, product = base.split('/').pop()!;
  const [label, cube, qq, hk] = await Promise.all([download(`${base}_1.LBL`), download(`${base}_1.QUB`), download(`${base}_QQ_1.QUB`), download(`${base}_HK_1.TAB`)]);
  const text = label.toString('latin1');
  const [bands, samples, lines] = (pds3Keyword(text, 'CORE_ITEMS') ?? '').replace(/[()]/gu, '').split(',').map(v => Number(v.trim()));
  if (pds3Keyword(text, 'TARGET_NAME') !== recipe.target.name || !(bands === 432 && samples === 256 && lines > 0) || cube.length !== bands * samples * lines * 4) return null;
  const dAU = Number.parseFloat(pds3Keyword(text, 'SPACECRAFT_SOLAR_DISTANCE') ?? 'NaN') / 149597870.7;
  const rows = hk.toString('latin1').trim().split('\n').map(r => r.trim().split(/\s+/u)).filter(r => r[9] === 'open');
  if (rows.length !== lines || !Number.isFinite(dAU)) return null;
  const wl = (b: number, s: number) => qq.readFloatLE((s * bands + b) * 4);
  // Bands the parameters can read: those inside the recipe's range at the slit centre, padded for the boxcar.
  const half = Math.floor(recipe.bands.boxcar / 2), kept: number[] = [];
  for (let b = 0; b < bands; b++) { const w = wl(b, samples >> 1); if (w >= recipe.bands.range[0] && w <= recipe.bands.range[1]) kept.push(b); }
  const lo = Math.max(0, kept[0] - half), hi = Math.min(bands - 1, kept.at(-1)! + half);
  const clock = set.clock(recipe.instrument.spacecraft), radii = numbers(set.pool, `BODY${recipe.target.naifId}_RADII`), inv = radii.map(r => 1 / r / r);
  const out: number[] = [];
  for (let l = 0; l < lines; l++) {
    const [seconds, fraction] = rows[l][4].split('.');
    // HK clocks are decimal seconds; Dawn's SCLK counts 1/256 s. The exposure (column 16) is centred.
    const ticks = encodeClock(clock, `${seconds}.${Math.round(Number(`0.${fraction}`) * 256) % 256}`) + Number(rows[l][15]) * 128;
    const et = clockToEt(clock, set.leapSeconds, ticks);
    let cam;
    try { cam = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: recipe.instrument.spacecraft, target: recipe.target.naifId, bodyFrame: recipe.target.bodyFrame, instrument: recipe.instrument.naifId, et, aberration: 'LT+S', pixels: recipe.instrument.pixels }); }
    catch { continue; } // no pointing for this line
    const m = cam.rayMatrix, p = cam.positionKm;
    for (let s = 0; s < samples; s++) {
      const d = [0, 1, 2].map(k => m[k][0] * s + m[k][2]);
      const A = d[0] * d[0] * inv[0] + d[1] * d[1] * inv[1] + d[2] * d[2] * inv[2], B = 2 * (p[0] * d[0] * inv[0] + p[1] * d[1] * inv[1] + p[2] * d[2] * inv[2]), C = p[0] * p[0] * inv[0] + p[1] * p[1] * inv[1] + p[2] * p[2] * inv[2] - 1;
      const D = B * B - 4 * A * C;
      if (D < 0) continue;
      const t = (-B - Math.sqrt(D)) / 2 / A, q = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]];
      const nv = [q[0] * inv[0], q[1] * inv[1], q[2] * inv[2]], nl = Math.hypot(...nv), toCam = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], rc = Math.hypot(...toCam);
      const mu = (nv[0] * toCam[0] + nv[1] * toCam[1] + nv[2] * toCam[2]) / nl / rc, mu0 = (nv[0] * cam.sunDirection[0] + nv[1] * cam.sunDirection[1] + nv[2] * cam.sunDirection[2]) / nl;
      if (mu0 <= 0 || mu <= 0) continue;
      out.push(Math.atan2(q[2], Math.hypot(q[0], q[1])) * 180 / Math.PI, ((Math.atan2(q[1], q[0]) * 180 / Math.PI) + 360) % 360, mu0, mu, s);
      for (let b = lo; b <= hi; b++) out.push(Math.PI * cube.readFloatBE(((l * samples + s) * bands + b) * 4) * dAU * dAU / sun[b]);
    }
  }
  const width = 5 + hi - lo + 1, records = out.length / width;
  const wavelengths = Array.from({ length: samples }, (_, s) => Array.from({ length: hi - lo + 1 }, (_, i) => +wl(lo + i, s).toFixed(5)));
  const reduced: Reduced = { schema: REDUCED_SCHEMA, product, volume: phase.volume, sha256: sha256(cube), lines, samples, wavelengths, kept: [lo, hi], records };
  await writeFile(resolve(work, `${product}.f32`), Buffer.from(new Float32Array(out).buffer));
  await writeFile(resolve(work, `${product}.json`), JSON.stringify(reduced));
  return reduced;
}

async function loadSun(recipe: VirRecipe, work: string) {
  const path = resolve(work, 'solar-spectrum.tab');
  let text = await readFile(path, 'latin1').catch(() => '');
  if (!text) { text = (await download(`${recipe.archive}/${recipe.phases[0].volume}/CALIB/DAWN_VIR_IR_SOLAR_SPECTRUM_V2.TAB`)).toString('latin1'); await writeFile(path, text); }
  const sun = text.trim().split(/\s+/u).map(Number);
  if (sun.length !== 432 || sun.some(v => !(v > 0))) throw new Error('The solar spectrum must hold 432 positive values.');
  return sun;
}

/** Cubes run `parallel` at a time: the archive serves each download slowly, the reduction itself is quick. A cube whose
 * reduced files exist is skipped, so an interrupted run resumes. */
export async function reduce(recipe: VirRecipe, work: string, options: { limit?: number; only?: readonly string[]; parallel?: number } = {}) {
  await mkdir(work, { recursive: true });
  const sun = await loadSun(recipe, work);
  let started = 0;
  for (const phase of recipe.phases) {
    const paths = await kernelBankPaths(recipe.kernelSet, [...recipe.commonKernels, ...phase.kernels]);
    const set = await loadKernelSet(paths);
    const queue = phase.cubes.filter(path => !options.only || options.only.includes(path.split('/').pop()!.replace(/_1\.LBL$/u, '')));
    const worker = async () => {
      for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
        if (options.limit !== undefined && started >= options.limit) return;
        started++;
        const product = path.split('/').pop()!.replace(/_1\.LBL$/u, '');
        if (await readFile(resolve(work, `${product}.json`)).then(() => true, () => false)) continue;
        try {
          const reduced = await reduceCube(recipe, phase, path, set, sun, work);
          console.error(`${product} ${reduced ? `${reduced.records} pixels` : 'skipped'}`);
        } catch (error) { console.error(`${product} failed: ${(error as Error).message}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, options.parallel ?? 1) }, worker));
  }
}

/** Reduced cubes one at a time: all of them together are gigabytes. */
async function* readReduced(work: string) {
  const names = (await readdir(work)).filter(name => name.startsWith('VIR_') && name.endsWith('.json')).sort();
  for (const name of names) {
    const header = JSON.parse(await readFile(resolve(work, name), 'utf8')) as Reduced;
    const bytes = await readFile(resolve(work, name.replace(/\.json$/u, '.f32')));
    yield { header, data: new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4) };
  }
}

/** Per-(band, sample) gain: the median over all cubes and lines of each pixel's I/F divided by the median of its
 * neighbouring samples on the same line. Geology does not follow detector columns; the stripes do. */
export async function stripes(recipe: VirRecipe, work: string) {
  const k = recipe.policy.stripeNeighbours, S = 256;
  let bandsKept = 0, ratios: number[][][] = [];
  // The detector's column gains come from the primary phases, so a fill phase never changes the primary map.
  const primaryVolumes = new Set(recipe.phases.filter(phase => phase.role === 'primary').map(phase => phase.volume));
  for await (const { header, data } of readReduced(work)) {
    if (!primaryVolumes.has(header.volume)) continue;
    if (!bandsKept) { bandsKept = header.kept[1] - header.kept[0] + 1; ratios = Array.from({ length: bandsKept }, () => Array.from({ length: S }, () => [])); }
    const width = 5 + header.kept[1] - header.kept[0] + 1;
    if (width - 5 !== bandsKept) continue;
    // Group this cube's records by line: records are written line by line in sample order.
    const bySample = new Map<number, number>();
    let lineStart = 0;
    for (let r = 0; r <= header.records; r++) {
      const s = r < header.records ? data[r * width + 4] : -1;
      if (r === header.records || (r > lineStart && s <= data[(r - 1) * width + 4])) {
        for (const [sample, index] of bySample) for (let b = 0; b < bandsKept; b++) {
          const neighbours: number[] = [];
          for (let o = -k; o <= k; o++) { const j = bySample.get(sample + o); if (o !== 0 && j !== undefined) neighbours.push(data[j * width + 5 + b]); }
          if (neighbours.length < k) continue;
          neighbours.sort((x, y) => x - y);
          const reference = neighbours[neighbours.length >> 1], value = data[index * width + 5 + b];
          if (reference > 0 && value > 0 && ratios[b][sample].length < 4000) ratios[b][sample].push(value / reference);
        }
        bySample.clear(); lineStart = r;
      }
      if (r < header.records) bySample.set(s, r);
    }
  }
  const gain = ratios.map(row => row.map(list => { if (list.length < 50) return 1; list.sort((x, y) => x - y); return list[list.length >> 1]; }));
  await writeFile(resolve(work, 'stripes.json'), JSON.stringify({ neighbours: k, gain }));
  return gain;
}

/** Frigeri et al. (2019): the continuum joins the reflectance at the left anchor (the maximum within `left`) and the right
 * anchor (the maximum within `right`); the band depth is 1 - Rb/Rc at the band minimum between them (Clark and Roush). */
export function bandDepth(wavelengths: readonly number[], iof: readonly number[], continuum: Continuum) {
  const inRange = ([a, b]: readonly [number, number]) => wavelengths.map((w, i) => [w, i] as const).filter(([w]) => w >= a && w <= b).map(([, i]) => i);
  const pick = (range: readonly [number, number]) => { const idx = inRange(range); if (!idx.length) return -1; return idx.reduce((x, y) => iof[y] > iof[x] ? y : x); };
  const left = pick(continuum.left), right = pick(continuum.right);
  if (left < 0 || right <= left + 1) return NaN;
  let depth = -Infinity;
  for (let i = left + 1; i < right; i++) {
    const f = (wavelengths[i] - wavelengths[left]) / (wavelengths[right] - wavelengths[left]), c = iof[left] * (1 - f) + iof[right] * f;
    if (c > 0) depth = Math.max(depth, 1 - iof[i] / c);
  }
  return Number.isFinite(depth) ? depth : NaN;
}

/** One reduced cube's band parameters on the map grid: destriped, gaps bridged, each pixel footprint rasterised.
 * `visit` receives every covered cell once with the parameter values there. */
export function projectCube(recipe: VirRecipe, gain: number[][], header: Reduced, data: Float32Array, ppd: number, visit: (cell: number, values: number[]) => void) {
  const limit = recipe.output.latitudeLimitDegrees, width = 360 * ppd, height = 2 * limit * ppd;
  const cosI = Math.cos(recipe.policy.maximumIncidenceDegrees * Math.PI / 180), cosE = Math.cos(recipe.policy.maximumEmissionDegrees * Math.PI / 180), half = Math.floor(recipe.bands.boxcar / 2);
  const n = header.kept[1] - header.kept[0] + 1, rowWidth = 5 + n;
  // Pixel values first: band parameters per record, NaN where the pixel is outside the limits or on a bad column.
  const values = recipe.parameters.map(() => new Float32Array(header.records).fill(NaN)), line = new Int32Array(header.records);
  let currentLine = 0;
  for (let r = 0; r < header.records; r++) {
    const o = r * rowWidth, s = data[o + 4];
    if (r > 0 && s <= data[o - rowWidth + 4]) currentLine++;
    line[r] = currentLine;
    if (data[o + 2] < cosI || data[o + 3] < cosE || Math.abs(data[o]) >= limit) continue;
    // A column whose stripe gain is far from 1 is a dead or hot detector pixel, not a stripe; it is filled below.
    if (gain.some(row => !(row[s] > recipe.policy.minimumGain && row[s] < 1 / recipe.policy.minimumGain))) continue;
    const corrected = Array.from({ length: n }, (_, b) => data[o + 5 + b] / gain[b][s]);
    if (corrected.some(v => !(v > 0))) continue;
    const smooth: number[] = [], waves: number[] = [];
    for (let b = half; b < n - half; b++) { let sum = 0; for (let j = -half; j <= half; j++) sum += corrected[b + j]; smooth.push(sum / (2 * half + 1)); waves.push(header.wavelengths[s][b]); }
    recipe.parameters.forEach((parameter, i) => { values[i][r] = bandDepth(waves, smooth, parameter.continuum); });
  }
  const index = new Map<number, number>();
  for (let r = 0; r < header.records; r++) index.set(line[r] * 1024 + data[r * rowWidth + 4], r);
  // Dead or hot columns (and pixels with a bad band) leave short gaps along a line: bridge gaps of up to
  // `maximumColumnGap` samples by linear interpolation between the valid samples on either side, so footprints stay continuous.
  const lines = currentLine + 1, gap = recipe.policy.maximumColumnGap;
  const fill: number[] = [];
  for (let l = 0; l < lines; l++) {
    let previous = -1;
    for (let s = 0; s < 256; s++) {
      const r = index.get(l * 1024 + s);
      if (r === undefined || !Number.isFinite(values[0][r])) continue;
      if (previous >= 0 && s - previous > 1 && s - previous <= gap + 1) {
        const r0 = index.get(l * 1024 + previous)!;
        for (let m = previous + 1; m < s; m++) {
          const rm = index.get(l * 1024 + m);
          if (rm === undefined) continue;
          const f = (m - previous) / (s - previous);
          values.forEach(v => { v[rm] = v[r0] * (1 - f) + v[r] * f; });
          fill.push(rm);
        }
      }
      previous = s;
    }
  }
  // Despike (Frigeri et al. 2019, Section 3.1): a pixel whose band parameter departs from the median of its 3 x 3
  // detector neighbours by more than a modified z-score of `outlierModifiedZ` (Iglewicz and Hoaglin 1993, over this
  // cube's residuals) takes that median.
  for (const v of values) {
    const residual = new Float32Array(header.records).fill(NaN), local = new Float32Array(header.records).fill(NaN);
    for (let r = 0; r < header.records; r++) {
      if (!Number.isFinite(v[r])) continue;
      const s = data[r * rowWidth + 4], around: number[] = [];
      for (let dl = -1; dl <= 1; dl++) for (let ds = -1; ds <= 1; ds++) {
        if (!dl && !ds) continue;
        const q = index.get((line[r] + dl) * 1024 + s + ds);
        if (q !== undefined && Number.isFinite(v[q])) around.push(v[q]);
      }
      if (around.length < 5) continue;
      around.sort((x, y) => x - y); local[r] = around[around.length >> 1]; residual[r] = v[r] - local[r];
    }
    const finite = Array.from(residual).filter(Number.isFinite).sort((x, y) => x - y);
    if (finite.length < 100) continue;
    const median = finite[finite.length >> 1], mad = Array.from(finite, x => Math.abs(x - median)).sort((x, y) => x - y)[finite.length >> 1];
    if (!(mad > 0)) continue;
    for (let r = 0; r < header.records; r++) if (Number.isFinite(residual[r]) && 0.6745 * Math.abs(residual[r] - median) / mad > recipe.policy.outlierModifiedZ) v[r] = local[r];
  }
  // Scene-based destriping per cube: a column's median over its lines, minus the median of its neighbours' medians,
  // is that column's offset in this cube. Geology does not follow detector columns over a whole cube; stripes do.
  for (const v of values) {
    const byColumn = new Map<number, number[]>();
    for (let r = 0; r < header.records; r++) if (Number.isFinite(v[r])) { const s = data[r * rowWidth + 4]; (byColumn.get(s) ?? byColumn.set(s, []).get(s)!).push(v[r]); }
    const med = new Map<number, number>();
    for (const [s, list] of byColumn) if (list.length >= recipe.policy.minimumColumnPixels) { list.sort((x, y) => x - y); med.set(s, list[list.length >> 1]); }
    const offset = new Map<number, number>();
    for (const [s, m] of med) {
      const around: number[] = [];
      for (let o = -recipe.policy.destripeNeighbours; o <= recipe.policy.destripeNeighbours; o++) { const x = med.get(s + o); if (o !== 0 && x !== undefined) around.push(x); }
      if (around.length < recipe.policy.destripeNeighbours) continue;
      around.sort((x, y) => x - y); offset.set(s, m - around[around.length >> 1]);
    }
    for (let r = 0; r < header.records; r++) { const d = offset.get(data[r * rowWidth + 4]); if (d !== undefined) v[r] -= d; }
  }
  // Quads wider than this bridge a gap, not neighbouring pixels: `maximumQuadKm`, or for a coarser cube one median pixel step
  // plus that step foreshortened at the emission limit, whichever is larger.
  const kmPerDegree = recipe.target.referenceRadiusKm * Math.PI / 180;
  const maximumQuadDegrees = Math.max(recipe.policy.maximumQuadKm, pixelStepKm(recipe, header, data) * (1 + 1 / cosE)) / kmPerDegree;
  // Footprints: each 2 x 2 block of neighbouring pixels spans a quadrilateral on the map (Frigeri et al. map the whole
  // integration footprint, not the pixel centre). Every cell centre inside it takes the corners' interpolated value.
  const at = index;
  const lonOf = (r: number, reference: number) => { let lon = data[r * rowWidth + 1]; while (lon - reference > 180) lon -= 360; while (reference - lon > 180) lon += 360; return lon; };
  const touched = new Uint8Array(width * height);
  for (const [key, r00] of at) {
    const l = Math.floor(key / 1024), s = key % 1024;
    const corners = [r00, at.get(l * 1024 + s + 1), at.get((l + 1) * 1024 + s + 1), at.get((l + 1) * 1024 + s)];
    if (corners.some(c => c === undefined || values.some(v => !Number.isFinite(v[c])))) continue;
    const rs = corners as number[], ref = data[r00 * rowWidth + 1];
    const lons = rs.map(c => lonOf(c, ref)), lats = rs.map(c => data[c * rowWidth]);
    if (Math.max(...lons) - Math.min(...lons) > maximumQuadDegrees / Math.max(0.2, Math.cos(lats[0] * Math.PI / 180)) || Math.max(...lats) - Math.min(...lats) > maximumQuadDegrees) continue;
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const x = [lons[a], lons[b], lons[c]], y = [lats[a], lats[b], lats[c]];
      const det = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]);
      if (Math.abs(det) < 1e-12) continue;
      const colMin = Math.ceil(Math.min(...x) * ppd - 0.5), colMax = Math.floor(Math.max(...x) * ppd - 0.5);
      const rowMin = Math.ceil((limit - Math.max(...y)) * ppd - 0.5), rowMax = Math.floor((limit - Math.min(...y)) * ppd - 0.5);
      for (let row = Math.max(0, rowMin); row <= Math.min(height - 1, rowMax); row++) for (let col = colMin; col <= colMax; col++) {
        const px = (col + 0.5) / ppd, py = limit - (row + 0.5) / ppd;
        const w0 = ((y[1] - y[2]) * (px - x[2]) + (x[2] - x[1]) * (py - y[2])) / det, w1 = ((y[2] - y[0]) * (px - x[2]) + (x[0] - x[2]) * (py - y[2])) / det, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const cell = row * width + (((col % width) + width) % width);
        if (touched[cell]) continue; // one sample per cell per cube: overlapping cubes are what get averaged
        touched[cell] = 1;
        visit(cell, values.map(v => w0 * v[rs[a]] + w1 * v[rs[b]] + w2 * v[rs[c]]));
      }
    }
  }
}

/** A cube's ground resolution: the larger of its median distances between neighbouring samples and between neighbouring
 * lines, in km on the reference sphere. */
export function pixelStepKm(recipe: VirRecipe, header: Reduced, data: Float32Array) {
  const rowWidth = 5 + header.kept[1] - header.kept[0] + 1, kmPerDegree = recipe.target.referenceRadiusKm * Math.PI / 180, index = new Map<number, number>();
  let line = 0;
  for (let r = 0; r < header.records; r++) { if (r > 0 && data[r * rowWidth + 4] <= data[(r - 1) * rowWidth + 4]) line++; index.set(line * 1024 + data[r * rowWidth + 4], r); }
  const steps: number[][] = [[], []];
  for (const [key, r] of index) for (const [k, next] of [[0, index.get(key + 1)], [1, index.get(key + 1024)]] as const) {
    if (next === undefined) continue;
    const dLat = data[next * rowWidth] - data[r * rowWidth], dLon = ((data[next * rowWidth + 1] - data[r * rowWidth + 1] + 540) % 360 - 180) * Math.cos(data[r * rowWidth] * Math.PI / 180);
    steps[k].push(Math.hypot(dLat, dLon) * kmPerDegree);
  }
  return Math.max(...steps.map(list => list.length ? list.sort((x, y) => x - y)[list.length >> 1] : 0));
}

/** Mean over a (2h+1) x (2h+1) box of the valid cells of a dense grid, NaN meaning no data; columns wrap when `wrap`. */
export function boxMean(grid: Float32Array, width: number, height: number, half: number, wrap: boolean) {
  const sum = new Float64Array((width + 1) * (height + 1)), count = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) { let rs = 0, rc = 0; for (let x = 0; x < width; x++) { const v = grid[y * width + x]; if (Number.isFinite(v)) { rs += v; rc++; }
    sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1] + rs; count[(y + 1) * (width + 1) + x + 1] = count[y * (width + 1) + x + 1] + rc; } }
  const rect = (table: Float64Array, x0: number, y0: number, x1: number, y1: number) => table[(y1 + 1) * (width + 1) + x1 + 1] - table[y0 * (width + 1) + x1 + 1] - table[(y1 + 1) * (width + 1) + x0] + table[y0 * (width + 1) + x0];
  const out = new Float32Array(width * height).fill(NaN);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      if (!Number.isFinite(grid[y * width + x])) continue;
      let s = 0, c = 0;
      const spans = !wrap ? [[Math.max(0, x - half), Math.min(width - 1, x + half)]]
        : x - half < 0 ? [[0, x + half], [width + x - half, width - 1]] : x + half >= width ? [[x - half, width - 1], [0, x + half - width]] : [[x - half, x + half]];
      for (const [a, b] of spans) { s += rect(sum, a, y0, b, y1); c += rect(count, a, y0, b, y1); }
      out[y * width + x] = c ? s / c : NaN;
    }
  }
  return out;
}

/** One reduced cube projected at `ppd`: its header and, unless its band count differs from the stripe table, the cells
 * it covers with each parameter's values there. */
export async function projectReducedFile(recipe: VirRecipe, gain: number[][], work: string, name: string, ppd: number, fillMaximumStepKm = Infinity) {
  const header = JSON.parse(await readFile(resolve(work, name), 'utf8')) as Reduced;
  if (header.kept[1] - header.kept[0] + 1 !== gain.length) return { header, projected: null };
  const bytes = await readFile(resolve(work, name.replace(/\.json$/u, '.f32'))), data = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  // A fill cube coarser than the coarsest primary cube would smear its few pixels over the gap; it is left out.
  const fill = recipe.phases.some(phase => phase.volume === header.volume && phase.role === 'fill');
  if (fill && header.records && pixelStepKm(recipe, header, data) > fillMaximumStepKm) return { header, projected: null };
  const cells: number[] = [], values: number[][] = recipe.parameters.map(() => []);
  projectCube(recipe, gain, header, data, ppd, (cell, v) => { cells.push(cell); v.forEach((x, i) => values[i].push(x)); });
  // ISIS3 noseam, per image: the high-pass part is the image minus its own box mean over `seamBoxCells`.
  const width = 360 * ppd, highPass: Float32Array<ArrayBuffer>[] = values.map(() => new Float32Array(cells.length));
  if (cells.length) {
    const cols = cells.map(cell => cell % width), rows = cells.map(cell => Math.floor(cell / width));
    // Unwrap the cube's columns across 0 degrees so its bounding box is contiguous.
    // Loops, not spreads: a distant cube can cover millions of cells.
    const extent = (list: number[]) => { let lo = Infinity, hi = -Infinity; for (const v of list) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
    const [c0, c1] = extent(cols), shift = c1 - c0 > width / 2 ? width : 0, uc = cols.map(c => c < width / 2 ? c + shift : c);
    const [x0, x1] = extent(uc), [y0, y1] = extent(rows), w = x1 - x0 + 1, h = y1 - y0 + 1, half = (recipe.policy.seamBoxCells - 1) / 2;
    values.forEach((list, i) => {
      const grid = new Float32Array(w * h).fill(NaN);
      list.forEach((v, k) => { grid[(rows[k] - y0) * w + uc[k] - x0] = v; });
      const low = boxMean(grid, w, h, half, false);
      list.forEach((v, k) => { highPass[i][k] = v - low[(rows[k] - y0) * w + uc[k] - x0]; });
    });
  }
  return { header, projected: { cells: Int32Array.from(cells), values: values.map(list => Float32Array.from(list)), highPass } };
}

/** Every reduced cube projected at `ppd` on a pool of worker threads, delivered in file order. */
async function projectAll(recipe: VirRecipe, gain: number[][], work: string, ppd: number, deliver: (result: Awaited<ReturnType<typeof projectReducedFile>>) => void, fillMaximumStepKm = Infinity) {
  const names = (await readdir(work)).filter(name => name.startsWith('VIR_') && name.endsWith('.json')).sort();
  const size = Math.max(1, Math.min(names.length, cpus().length - 2)), url = new URL('./vir-project-worker.mts', import.meta.url);
  const workers = Array.from({ length: size }, () => new Worker(url, { workerData: { recipe, gain, work, ppd, fillMaximumStepKm } }));
  const results = new Map<number, Awaited<ReturnType<typeof projectReducedFile>>>();
  let next = 0, delivered = 0;
  try {
    await new Promise<void>((done, fail) => {
      const flush = () => { while (results.has(delivered)) { deliver(results.get(delivered)!); results.delete(delivered); delivered++; } if (delivered === names.length) done(); };
      const feed = (worker: Worker) => {
        if (next >= names.length) return;
        const job = next++;
        worker.once('message', result => { results.set(job, result); flush(); feed(worker); });
        worker.postMessage(names[job]);
      };
      for (const worker of workers) { worker.once('error', fail); feed(worker); }
      if (!names.length) done();
    });
  } finally { await Promise.all(workers.map(worker => worker.terminate())); }
}

/** Equalization (as ISIS3's `equalizer` does for image mosaics): each cube gets one offset per parameter so that
 * overlapping cubes agree. On a coarse grid, every pair of cubes sharing at least `minimumOverlapCells` cells gives the
 * mean difference over those cells; offsets minimise the squared disagreement, weighted by the shared cell count, with
 * their mean held at zero so the global level is unchanged. Also reports the overlap RMS before and after. */
export async function equalize(recipe: VirRecipe, work: string, volumes?: ReadonlySet<string>, fillMaximumStepKm = Infinity) {
  const { gain } = JSON.parse(await readFile(resolve(work, 'stripes.json'), 'utf8')) as { gain: number[][] };
  const ppd = recipe.policy.equalizePixelsPerDegree, P = recipe.parameters.length;
  const products: string[] = [], cellLists: Map<number, number[]>[] = [];
  await projectAll(recipe, gain, work, ppd, ({ header, projected }) => {
    if (!projected || (volumes && !volumes.has(header.volume))) return;
    const cells = new Map<number, number[]>();
    projected.cells.forEach((cell, k) => { cells.set(cell, projected.values.map(v => v[k])); });
    products.push(header.product); cellLists.push(cells);
  }, fillMaximumStepKm);
  // Pairwise mean differences over shared cells.
  const byCell = new Map<number, number[]>();
  cellLists.forEach((cells, i) => { for (const cell of cells.keys()) (byCell.get(cell) ?? byCell.set(cell, []).get(cell)!).push(i); });
  const pairs = new Map<string, { i: number; j: number; count: number; sum: number[]; squares: number[] }>();
  for (const [cell, owners] of byCell) for (let a = 0; a < owners.length; a++) for (let b = a + 1; b < owners.length; b++) {
    const i = owners[a], j = owners[b], key = `${i}:${j}`, vi = cellLists[i].get(cell)!, vj = cellLists[j].get(cell)!;
    const pair = pairs.get(key) ?? pairs.set(key, { i, j, count: 0, sum: Array(P).fill(0), squares: Array(P).fill(0) }).get(key)!;
    pair.count++;
    for (let p = 0; p < P; p++) { const d = vi[p] - vj[p]; pair.sum[p] += d; pair.squares[p] += d * d; }
  }
  const usable = [...pairs.values()].filter(pair => pair.count >= recipe.policy.minimumOverlapCells);
  const offsets = products.map(() => Array(P).fill(0));
  for (let p = 0; p < P; p++) {
    // Gauss-Seidel on the weighted normal equations: o_i = sum_j w_ij (d_ij + o_j) / sum_j w_ij, then remove the mean.
    for (let iteration = 0; iteration < 500; iteration++) {
      let change = 0;
      for (let i = 0; i < products.length; i++) {
        let numerator = 0, weight = 0;
        for (const pair of usable) {
          if (pair.i === i) { numerator += pair.count * (pair.sum[p] / pair.count + offsets[pair.j][p]); weight += pair.count; }
          else if (pair.j === i) { numerator += pair.count * (-pair.sum[p] / pair.count + offsets[pair.i][p]); weight += pair.count; }
        }
        if (!weight) continue;
        const next = numerator / weight; change = Math.max(change, Math.abs(next - offsets[i][p])); offsets[i][p] = next;
      }
      const mean = offsets.reduce((sum, o) => sum + o[p], 0) / offsets.length;
      offsets.forEach(o => { o[p] -= mean; });
      if (change < 1e-6) break;
    }
  }
  const rms = (after: boolean) => Array.from({ length: P }, (_, p) => {
    let squares = 0, count = 0;
    for (const pair of usable) {
      const shift = after ? offsets[pair.i][p] - offsets[pair.j][p] : 0;
      squares += pair.squares[p] - 2 * shift * pair.sum[p] + pair.count * shift * shift; count += pair.count;
    }
    return Math.sqrt(squares / count);
  });
  const report = { pixelsPerDegree: ppd, cubes: products.length, pairs: usable.length, overlapRmsBefore: rms(false), overlapRmsAfter: rms(true),
    offsets: Object.fromEntries(products.map((product, i) => [product, offsets[i].map(v => +v.toFixed(5))])) };
  await writeFile(resolve(work, 'offsets.json'), JSON.stringify(report));
  return report;
}

/** Band depth depends on the phase angle: cubes seen at higher phase read deeper. `phase` measures each cube's offset
 * against its overlapping neighbours (as `equalize` does), fits those offsets against the cube's phase angle from the
 * archive's geometry index, and writes the slope per parameter. The mosaic then brings each cube to the standard phase of
 * Ciarniello et al. (2017), 30 degrees. Only what phase explains is removed; regional differences stay. */
export async function phase(recipe: VirRecipe, work: string) {
  // Primary phases alone set the slope and the outlier limits, so adding a fill phase leaves the primary map unchanged.
  const primaryVolumes = new Set(recipe.phases.filter(p => p.role === 'primary').map(p => p.volume));
  const equalized = await equalize(recipe, work, primaryVolumes), phases = new Map<string, number>();
  let fillMaximumStepKm = 0;
  for await (const { header, data } of readReduced(work)) if (primaryVolumes.has(header.volume) && header.records) fillMaximumStepKm = Math.max(fillMaximumStepKm, pixelStepKm(recipe, header, data));
  for (const { volume } of recipe.phases) {
    const text = (await download(`${recipe.archive}/${volume}/INDEX/GEOM_INDEX.TAB`)).toString('latin1');
    for (const line of text.split(/\r?\n/u).slice(1)) {
      const fields = line.split(',').map(field => field.trim().replace(/^"|"$/gu, '').trim());
      if (fields.length < 15 || /_(HK|QQ)_/u.test(fields[2])) continue;
      const product = fields[2].split('/').pop()!.replace(/_1\.LBL$/u, ''), value = Number(fields[14]);
      if (Number.isFinite(value) && value >= 0) phases.set(product, value);
    }
  }
  // Cubes whose overlap offset is an outlier in any parameter (modified z-score over 3.5, Iglewicz and Hoaglin 1993)
  // disagree with every neighbour; they are left out of the fit and of the mosaic.
  const outliers = (entries: [string, number[]][], reference: [string, number[]][], into: Set<string>) => recipe.parameters.forEach((_, p) => {
    const values = reference.map(([, o]) => o[p]).sort((x, y) => x - y), median = values[values.length >> 1];
    const deviations = values.map(v => Math.abs(v - median)).sort((x, y) => x - y), mad = deviations[deviations.length >> 1];
    for (const [product, o] of entries) if (0.6745 * Math.abs(o[p] - median) / mad > recipe.policy.outlierModifiedZ) into.add(product);
  });
  const entries = Object.entries(equalized.offsets), rejected = new Set<string>();
  outliers(entries, entries, rejected);
  const points = entries.filter(([product]) => phases.has(product) && !rejected.has(product));
  const x = points.map(([product]) => phases.get(product)!), mx = x.reduce((a, b) => a + b, 0) / x.length;
  const fit = recipe.parameters.map((_, p) => {
    const y = points.map(([, offsets]) => offsets[p]), my = y.reduce((a, b) => a + b, 0) / y.length;
    let sxy = 0, sxx = 0, syy = 0;
    x.forEach((xi, i) => { sxy += (xi - mx) * (y[i] - my); sxx += (xi - mx) ** 2; syy += (y[i] - my) ** 2; });
    return { slopePerDegree: sxy / sxx, correlation: sxy / Math.sqrt(sxx * syy) };
  });
  // Offsets brought to the reference phase and measured from the accepted primary cubes' median level.
  const used = points.map(([product]) => product), primaryProducts = new Set(used);
  const level = (offsets: Record<string, number[]>) => {
    const corrected = Object.entries(offsets).filter(([product]) => phases.has(product))
      .map(([product, o]): [string, number[]] => [product, o.map((v, p) => v - fit[p].slopePerDegree * (phases.get(product)! - recipe.policy.referencePhaseDegrees))]);
    const medians = recipe.parameters.map((_, p) => { const v = corrected.filter(([product]) => primaryProducts.has(product)).map(([, o]) => o[p]).sort((a, b) => a - b); return v[v.length >> 1]; });
    return corrected.map(([product, o]): [string, number[]] => [product, o.map((v, p) => v - medians[p])]);
  };
  const residuals = new Map(level(equalized.offsets));
  // Fill cubes: offsets from a joint solve, judged against the primary cubes' spread there.
  if (primaryVolumes.size < recipe.phases.length) {
    const joint = level((await equalize(recipe, work, undefined, fillMaximumStepKm)).offsets), fillEntries = joint.filter(([product]) => !equalized.offsets[product]);
    outliers(fillEntries, joint.filter(([product]) => primaryProducts.has(product)), rejected);
    for (const [product, residual] of fillEntries) { residuals.set(product, residual); if (!rejected.has(product)) used.push(product); }
  }
  // Rejected cubes keep their measured level offset (as ISIS3 equalizer applies one) and serve only cells no accepted cube saw.
  const levelled = Object.fromEntries([...rejected].filter(product => residuals.has(product)).sort().map(product => [product, residuals.get(product)!.map(v => +v.toFixed(5))]));
  const result = { referenceDegrees: recipe.policy.referencePhaseDegrees, fillMaximumStepKm: +fillMaximumStepKm.toFixed(3), cubes: used.length, rejected: [...rejected].sort(), levelled, fit,
    phases: Object.fromEntries([...used, ...Object.keys(levelled)].map(product => [product, phases.get(product)!])) };
  await writeFile(resolve(work, 'photometry.json'), JSON.stringify(result));
  return result;
}

export async function mosaic(recipe: VirRecipe, root: string, work: string) {
  const { gain } = JSON.parse(await readFile(resolve(work, 'stripes.json'), 'utf8')) as { gain: number[][] };
  const photometry = await readFile(resolve(work, 'photometry.json'), 'utf8').then(text => JSON.parse(text) as { referenceDegrees: number; fillMaximumStepKm?: number; rejected: string[]; levelled?: Record<string, number[]>; fit: { slopePerDegree: number }[]; phases: Record<string, number> }, () => null);
  const cubeRecords: { product: string; volume: string; sha256: string; lines: number; pixels: number; offsets: number[] | null }[] = [];
  const ppd = recipe.output.pixelsPerDegree, limit = recipe.output.latitudeLimitDegrees, width = 360 * ppd, height = 2 * limit * ppd;
  const layer = () => ({ sums: recipe.parameters.map(() => new Float64Array(width * height)), highSums: recipe.parameters.map(() => new Float64Array(width * height)), counts: new Uint16Array(width * height) });
  // Tiers in priority order: accepted primary cubes, each fill phase in recipe order, then rejected cubes levelled by their offset.
  const fillVolumes = recipe.phases.filter(phase => phase.role === 'fill').map(phase => phase.volume), tiers = Array.from({ length: fillVolumes.length + 2 }, layer);
  let used = 0, levelledUsed = 0;
  await projectAll(recipe, gain, work, ppd, ({ header, projected }) => {
    const cubePhase = photometry?.phases[header.product];
    const levelled = photometry?.levelled?.[header.product], rejected = photometry?.rejected.includes(header.product) ?? false;
    const shift = photometry && cubePhase !== undefined ? photometry.fit.map((f, i) => f.slopePerDegree * (cubePhase - photometry.referenceDegrees) + (rejected ? levelled?.[i] ?? 0 : 0)) : null;
    cubeRecords.push({ product: header.product, volume: header.volume, sha256: header.sha256, lines: header.lines, pixels: header.records, offsets: shift });
    if (!projected || (rejected && !levelled)) return;
    if (rejected) levelledUsed++; else used++;
    const target = tiers[rejected ? tiers.length - 1 : fillVolumes.indexOf(header.volume) + 1];
    projected.cells.forEach((cell, k) => { projected.values.forEach((v, i) => { target.sums[i][cell] += v[k] - (shift?.[i] ?? 0); target.highSums[i][cell] += projected.highPass[i][k]; }); target.counts[cell]++; });
  }, photometry?.fillMaximumStepKm ?? Infinity);
  const minimum = recipe.policy.minimumCellCount, cells = width * height, tierOf = new Uint8Array(cells).fill(tiers.length), tierCells = tiers.map(() => 0);
  for (let c = 0; c < cells; c++) { const t = tiers.findIndex(tier => tier.counts[c] >= minimum); if (t >= 0) { tierOf[c] = t; tierCells[t]++; } }
  const covered = tierCells.reduce((a, b) => a + b, 0);
  for (const [i, parameter] of recipe.parameters.entries()) {
    const map = new Float32Array(width * height), high = new Float32Array(width * height);
    for (let c = 0; c < map.length; c++) {
      const from = tiers[tierOf[c]];
      map[c] = from ? from.sums[i][c] / from.counts[c] : NaN;
      high[c] = from ? from.highSums[i][c] / from.counts[c] : NaN;
    }
    // ISIS3 noseam: the low-pass of the averaged mosaic carries the broad level of all overlapping cubes, the averaged
    // high-pass parts carry each cube's detail; their sum has no seams at cube edges.
    const low = boxMean(map, width, height, (recipe.policy.seamBoxCells - 1) / 2, true);
    for (let c = 0; c < map.length; c++) if (Number.isFinite(map[c])) map[c] = low[c] + high[c];
    await writeMap(root, recipe, parameter, map, width, height);
  }
  const receipt = { schema: 'cssearth-vir-mosaic-receipt@1', cubes: cubeRecords,
    cubesUsed: used, levelledCubesUsed: levelledUsed, cells, coveredCells: covered, filledCells: Object.fromEntries(fillVolumes.map((volume, i) => [volume, tierCells[i + 1]])), levelledCells: tierCells[tiers.length - 1], coverage: covered / (width * height), stripeNeighbours: recipe.policy.stripeNeighbours };
  await writeFile(resolve(root, recipe.output.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

async function writeMap(root: string, recipe: VirRecipe, parameter: BandParameter, map: Float32Array, width: number, height: number) {
  const ppd = recipe.output.pixelsPerDegree, limit = recipe.output.latitudeLimitDegrees, missing = -1e32, bytes = Buffer.alloc(map.length * 4);
  for (let i = 0; i < map.length; i++) bytes.writeFloatLE(Number.isFinite(map[i]) ? map[i] : missing, i * 4);
  const r = recipe.target.referenceRadiusKm;
  const label = ['PDS_VERSION_ID = PDS3', 'RECORD_TYPE = FIXED_LENGTH', `RECORD_BYTES = ${width * 4}`, `FILE_RECORDS = ${height}`, `^IMAGE = "${parameter.image.split('/').pop()}"`,
    `DATA_SET_ID = "${recipe.output.dataSetId}"`, `PRODUCT_ID = "${parameter.productId}"`, `TARGET_NAME = "${recipe.target.name}"`,
    `NOTE = "Band depth ${parameter.id} from Dawn VIR IR calibrated cubes, mean of overlapping pixels. Written by tools/objects/dawn/vir-mosaic.mts."`,
    'OBJECT = IMAGE', `  LINES = ${height}`, `  LINE_SAMPLES = ${width}`, '  SAMPLE_TYPE = PC_REAL', '  SAMPLE_BITS = 32', '  SCALING_FACTOR = 1', '  OFFSET = 0', `  MISSING_CONSTANT = ${missing.toExponential()}`, 'END_OBJECT = IMAGE',
    'OBJECT = IMAGE_MAP_PROJECTION', '  MAP_PROJECTION_TYPE = "EQUIRECTANGULAR"', '  COORDINATE_SYSTEM_NAME = "PLANETOCENTRIC"', '  COORDINATE_SYSTEM_TYPE = "BODY-FIXED ROTATING"',
    '  POSITIVE_LONGITUDE_DIRECTION = "EAST"', `  A_AXIS_RADIUS = ${r} <KM>`, `  B_AXIS_RADIUS = ${r} <KM>`, `  C_AXIS_RADIUS = ${r} <KM>`,
    '  CENTER_LATITUDE = 0', '  CENTER_LONGITUDE = 180', `  MAXIMUM_LATITUDE = ${limit}`, `  MINIMUM_LATITUDE = ${-limit}`, '  EASTERNMOST_LONGITUDE = 360', '  WESTERNMOST_LONGITUDE = 0',
    `  MAP_RESOLUTION = ${ppd} <PIX/DEG>`, `  SAMPLE_PROJECTION_OFFSET = ${180 * ppd - 0.5}`, `  LINE_PROJECTION_OFFSET = ${limit * ppd - 0.5}`, '  MAP_PROJECTION_ROTATION = 0.0 <degree>',
    'END_OBJECT = IMAGE_MAP_PROJECTION', 'END', ''].join('\r\n');
  await mkdir(dirname(resolve(root, parameter.image)), { recursive: true });
  // A `.gz` image is written gzipped (level 9, no timestamp) so large maps can be mirrored; the reader gunzips it.
  await writeFile(resolve(root, parameter.image), parameter.image.endsWith('.gz') ? gzipSync(bytes, { level: 9 }) : bytes); await writeFile(resolve(root, parameter.label), label);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2), [command, recipePath] = positionalArguments(args, ['--work', '--limit', '--only', '--parallel']), work = flagValue(args, '--work');
  if (!command || !recipePath || !work) throw new Error('Usage: node tools/objects/dawn/vir-mosaic.mts <reduce|stripes|mosaic> <recipe.json> --work <directory>');
  const recipe = parseRecipe(JSON.parse(await readFile(recipePath, 'utf8'))), root = dirname(resolve(recipePath));
  if (command === 'reduce') await reduce(recipe, resolve(work), { limit: flagValue(args, '--limit') === undefined ? undefined : Number(flagValue(args, '--limit')), only: flagValue(args, '--only')?.split(','), parallel: Number(flagValue(args, '--parallel') ?? 1) });
  else if (command === 'stripes') await stripes(recipe, resolve(work));
  else if (command === 'phase') { const r = await phase(recipe, resolve(work)); console.log(JSON.stringify({ cubes: r.cubes, rejected: r.rejected.length, fit: r.fit })); }
  else if (command === 'equalize') { const r = await equalize(recipe, resolve(work)); console.log(JSON.stringify({ cubes: r.cubes, pairs: r.pairs, before: r.overlapRmsBefore, after: r.overlapRmsAfter })); }
  else if (command === 'mosaic') console.log(JSON.stringify(await mosaic(recipe, root, resolve(work)), (key, value) => key === 'cubes' ? value.length : value, 2));
  else throw new Error(`Unknown command ${command}.`);
}
