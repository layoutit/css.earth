#!/usr/bin/env node
import type { SpiceCamera } from '@cssearth/objects';
/** A one-side map of one body in one JIRAM imager band from Juno JIRAM frames: Io's night-side 4.8 µm (M-band) thermal
 * emission is the first recipe.
 *
 *   node packages/bake/authoring/juno/jiram-mosaic.mts <recipe.json> --frames <directory> [--fetch] [--previews <directory>]
 *
 * Frames are read from `--frames` (an ignored scratch directory such as output/jiram/frames); `--fetch` downloads any
 * missing frame and label from the archive the recipe names and validates their product identity and layout.
 *
 * The recipe selects JIRAM RDR frames (PDS3 `JNO-J-JIRAM-3-RDR-V1.0`) grouped by visit, and the Juno kernel-bank files each
 * visit needs, and names the target (NAIF id, body-fixed frame, the label TARGET_NAME values accepted, the reference radius
 * written to the output label), the band (instrument id and pixel-model keys, which lines of 128- and 256-line frames hold
 * it, the unit written to the label) and the side to keep. For every frame the camera comes from the kernels (the band's
 * instrument, such as JUNO_JIRAM_I_MBAND, and the instrument kernel's pixel model), evaluated at the middle of the exposure. JIRAM's despinning mirror leaves the reconstructed pointing off by up
 * to about two degrees along the spin direction (JIRAM report JM0580), so each frame is registered to the sunlit disc:
 * a model of the lit hemisphere (cosine of the solar incidence, the Lambertian model of Mura et al. 2024) is slid over
 * the frame and the offset with the highest normalized correlation is kept. A frame is rejected when too little sunlit
 * disc falls in the search window, when the correlation is low, or when the best offset lies on the window's edge.
 *
 * The map keeps one side, past a terminator margin of `terminatorFootprints` pixel footprints: `night`, where JIRAM sees
 * thermal emission and no reflected sunlight, or `day`, lit cells with solar incidence below `maximumIncidenceDegrees`.
 * Each cell takes the median of the frames of one visit that saw it on that side (at least `minimumFramesPerVisit` of
 * them, which removes the single-frame particle hits), and across visits the visit that saw it with the smallest pixel
 * footprint. An optional night-column background subtracts detector reflections before projection; it measures radiance
 * above the cold background, not total thermal output. Cells without qualified observations remain missing.
 *
 * Output: a PDS3 simple-cylindrical float map with a detached label, as `pds3-float-map` reads it, and a receipt with
 * every frame's registration. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { loadKernelSet, type KernelSet } from '@cssearth/spice/node';
import { kernelBankPaths } from '@cssearth/bake/objects/cameras';
import { numbers, utcToEt, spiceCamera, type PixelModelKeys } from '@cssearth/spice';
import { pds3Keyword } from '@cssearth/telescope';
import { requireArray, requireFiniteNumber, requireRecord, requireString, dot3 as dot, flagValue, positionalArguments } from '@cssearth/core';

export const RECIPE_SCHEMA = 'cssearth-jiram-mosaic@1';
export const RECEIPT_SCHEMA = 'cssearth-jiram-mosaic-receipt@1';
/** The JIRAM imager: 432 samples, each band filter 128 lines. */
const JUNO = -61, WIDTH = 432, BAND_LINES = 128;

export interface JiramFrame { readonly productId: string; readonly volume: string }
export interface JiramVisit { readonly id: string; readonly kernels: readonly string[]; readonly frames: readonly JiramFrame[]; readonly maximumDetectorDn?: number }
/** Where a frame of this many lines holds the band; a mode prefix, when stated, is required of the frame's INSTRUMENT_MODE_ID. */
export interface JiramBandLayout { readonly firstLine: number; readonly modePrefix?: string }
export interface JiramRecipe {
  readonly schema: typeof RECIPE_SCHEMA; readonly archive: string; readonly kernelSet: string; readonly commonKernels: readonly string[]; readonly visits: readonly JiramVisit[];
  readonly target: { readonly name: string; readonly naifId: number; readonly bodyFrame: string; readonly labelNames: readonly string[]; readonly referenceRadiusKm: number };
  readonly band: { readonly name: string; readonly instrument: number; readonly pixels: PixelModelKeys; readonly frameLines: Readonly<Record<'128' | '256', JiramBandLayout | undefined>>; readonly unit: string };
  readonly side: 'night' | 'day';
  readonly background?: { readonly method: 'night-column-median'; readonly minimumSamples: number };
  readonly output: { readonly image: string; readonly label: string; readonly receipt: string; readonly productId: string; readonly pixelsPerDegree: number };
  readonly policy: {
    readonly minimumFramesPerVisit: number; readonly maximumEmissionDegrees: number; readonly terminatorFootprints: number;
    /** Day side only: the largest solar incidence kept. */
    readonly maximumIncidenceDegrees?: number;
    readonly searchAlongTrackPixels: number; readonly searchCrossTrackPixels: number; readonly minimumLitPixels: number; readonly minimumCorrelation: number;
    /** A visit shares one pointing bias: a frame whose offset strays further than this from its visit's median is a false fit. */
    readonly maximumVisitOffsetPixels: number;
  };
  /** Band radiance per archived unit: the archive's labels state two units for one calibration (see the README). */
  readonly unitScale: Readonly<Record<string, number>>;
}

export function parseRecipe(value: unknown): JiramRecipe {
  const recipe = requireRecord(value, 'JIRAM mosaic recipe');
  if (recipe.schema !== RECIPE_SCHEMA) throw new Error(`JIRAM mosaic recipe schema must be ${RECIPE_SCHEMA}.`);
  const strings = (v: unknown, what: string) => requireArray(v, what).map((s, i) => requireString(s, `${what}[${i}]`));
  const visits = requireArray(recipe.visits, 'visits').map((v, i) => {
    const visit = requireRecord(v, `visit ${i}`);
    const maximumDetectorDn = visit.maximumDetectorDn === undefined ? undefined : requireFiniteNumber(visit.maximumDetectorDn, 'maximumDetectorDn');
    if (maximumDetectorDn !== undefined && (!(maximumDetectorDn > 0) || !Number.isInteger(maximumDetectorDn))) throw new Error('maximumDetectorDn must be a positive integer.');
    return { id: requireString(visit.id, 'visit id'), kernels: strings(visit.kernels, 'visit kernels'), ...(maximumDetectorDn === undefined ? {} : {maximumDetectorDn}), frames: requireArray(visit.frames, 'frames').map((f, j) => {
      const frame = requireRecord(f, `frame ${j}`);
      const productId = requireString(frame.productId, 'productId'), volume = requireString(frame.volume, 'volume');
      if (!/^JIR_IMG_RDR_\d{7}T\d{6}_V\d{2}$/u.test(productId) || !/^jnojir_2\d{3}$/u.test(volume)) throw new TypeError('Expected a JIRAM RDR image and archive volume.');
      return { productId, volume };
    }) };
  });
  const output = requireRecord(recipe.output, 'output'), policy = requireRecord(recipe.policy, 'policy'), unitScale = requireRecord(recipe.unitScale, 'unitScale');
  const n = (record: Record<string, unknown>, key: string) => requireFiniteNumber(record[key], key);
  const archive = requireString(recipe.archive, 'archive');
  if (!archive.startsWith('https://')) throw new Error('The JIRAM archive must be an https URL.');
  const integer = (record: Record<string, unknown>, key: string) => { const v = n(record, key); if (!Number.isInteger(v)) throw new Error(`${key} must be an integer.`); return v; };
  const target = requireRecord(recipe.target, 'target'), band = requireRecord(recipe.band, 'band'), pixels = requireRecord(band.pixels, 'band pixels'), frameLines = requireRecord(band.frameLines, 'band frameLines');
  const unitKey = (key: string, units: readonly string[]) => {
    const entry = requireRecord(pixels[key], `band pixels ${key}`), unit = requireString(entry.unit, `band pixels ${key} unit`);
    if (!units.includes(unit)) throw new Error(`band pixels ${key} unit must be one of ${units.join(', ')}.`);
    return { key: requireString(entry.key, `band pixels ${key} key`), unit };
  };
  const focalLength = unitKey('focalLength', ['mm']), pixelPitch = unitKey('pixelPitch', ['micrometre', 'mm']);
  const keys = (key: string) => requireString(pixels[key], `band pixels ${key}`);
  const layout = (lines: '128' | '256'): JiramBandLayout | undefined => {
    if (frameLines[lines] === undefined) return undefined;
    const entry = requireRecord(frameLines[lines], `band frameLines ${lines}`), firstLine = integer(entry, 'firstLine');
    if (firstLine < 0 || firstLine + BAND_LINES > Number(lines)) throw new Error(`The band's ${BAND_LINES} lines do not fit a ${lines}-line frame from line ${firstLine}.`);
    return entry.modePrefix === undefined ? { firstLine } : { firstLine, modePrefix: requireString(entry.modePrefix, 'band modePrefix') };
  };
  const side = recipe.side;
  if (side !== 'night' && side !== 'day') throw new Error('The JIRAM mosaic side must be night or day.');
  let background: JiramRecipe['background'];
  if (recipe.background !== undefined) {
    const entry = requireRecord(recipe.background, 'background'), minimumSamples = integer(entry, 'minimumSamples');
    if (side !== 'night' || entry.method !== 'night-column-median' || minimumSamples < 1 || minimumSamples > BAND_LINES) throw new Error('Column background requires a night map and 1–128 samples.');
    background = { method: 'night-column-median', minimumSamples };
  }
  if (side === 'day' && policy.maximumIncidenceDegrees === undefined) throw new Error('A day-side JIRAM mosaic needs policy.maximumIncidenceDegrees.');
  const labelNames = strings(target.labelNames, 'target labelNames');
  if (!labelNames.length) throw new Error('target labelNames must name at least one TARGET_NAME.');
  return { schema: RECIPE_SCHEMA, archive, kernelSet: requireString(recipe.kernelSet, 'kernelSet'), commonKernels: strings(recipe.commonKernels, 'commonKernels'), visits,
    target: { name: requireString(target.name, 'target name'), naifId: integer(target, 'naifId'), bodyFrame: requireString(target.bodyFrame, 'target bodyFrame'), labelNames,
      referenceRadiusKm: n(target, 'referenceRadiusKm') },
    band: { name: requireString(band.name, 'band name'), instrument: integer(band, 'instrument'), unit: requireString(band.unit, 'band unit'),
      pixels: { focalLength: { key: focalLength.key, unit: 'mm' }, pixelPitch: { key: pixelPitch.key, unit: pixelPitch.unit === 'mm' ? 'mm' : 'micrometre' },
        center: keys('center'), boresight: keys('boresight'), samples: keys('samples'), lines: keys('lines'), frame: keys('frame'), origin: n(pixels, 'origin'), column: keys('column'), row: keys('row') },
      frameLines: { '128': layout('128'), '256': layout('256') } },
    side, ...(background === undefined ? {} : { background }),
    output: { image: requireString(output.image, 'output image'), label: requireString(output.label, 'output label'), receipt: requireString(output.receipt, 'output receipt'),
      productId: requireString(output.productId, 'output productId'), pixelsPerDegree: n(output, 'pixelsPerDegree') },
    policy: { minimumFramesPerVisit: n(policy, 'minimumFramesPerVisit'), maximumEmissionDegrees: n(policy, 'maximumEmissionDegrees'), terminatorFootprints: n(policy, 'terminatorFootprints'),
      searchAlongTrackPixels: n(policy, 'searchAlongTrackPixels'), searchCrossTrackPixels: n(policy, 'searchCrossTrackPixels'), minimumLitPixels: n(policy, 'minimumLitPixels'),
      minimumCorrelation: n(policy, 'minimumCorrelation'), maximumVisitOffsetPixels: n(policy, 'maximumVisitOffsetPixels'),
      ...(policy.maximumIncidenceDegrees === undefined ? {} : { maximumIncidenceDegrees: n(policy, 'maximumIncidenceDegrees') }) },
    unitScale: Object.fromEntries(Object.entries(unitScale).map(([k, v]) => [k, requireFiniteNumber(v, `unitScale ${k}`)])) };
}

/** The band's lines of a JIRAM imager RDR, where the recipe's `frameLines` places them. For the M band that is the whole
 * array in M-band-only (SCI_I2_) modes, else the last 128 lines: in a full 256-line frame the first half is the L band,
 * as sunlit Io reads about twice as bright there as in M-band-only frames of nearby dates, as sunlight at 3.3-3.6 µm is
 * against 4.5-5.0 µm, and the L-band frame of the kernels places its disc.
 * The RDR floats are little-endian although the label says IEEE_REAL. */
export function decodeFrame(bytes: Buffer, label: string, recipe: Pick<JiramRecipe, 'target' | 'band'>) {
  const lines = Number(pds3Keyword(label, 'LINES')), samples = Number(pds3Keyword(label, 'LINE_SAMPLES'));
  const layout = lines === 128 || lines === 256 ? recipe.band.frameLines[lines === 128 ? '128' : '256'] : undefined;
  if (samples !== WIDTH || !layout || bytes.length !== lines * samples * 4) throw new Error(`Unexpected JIRAM image layout ${samples} x ${lines}, ${bytes.length} bytes, for the ${recipe.band.name} band.`);
  // Io labels from 2022 on name no target; the lit-disc registration is what shows the body is in the frame.
  const target = pds3Keyword(label, 'TARGET_NAME') ?? '';
  if (!recipe.target.labelNames.includes(target)) throw new Error(`The frame is targeted at ${target}, not ${recipe.target.name}.`);
  const mode = pds3Keyword(label, 'INSTRUMENT_MODE_ID') ?? '';
  if (layout.modePrefix !== undefined && !mode.startsWith(layout.modePrefix)) throw new Error(`A ${lines}-line frame in mode ${mode} is not a ${recipe.band.name}-band image.`);
  const values = new Float32Array(WIDTH * BAND_LINES);
  const first = layout.firstLine * WIDTH;
  for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatLE((first + i) * 4);
  const unit = pds3Keyword(label, 'UNIT') ?? '';
  return { values, unit, mode, start: pds3Keyword(label, 'START_TIME') ?? '', stop: pds3Keyword(label, 'STOP_TIME') ?? '' };
}

/** Where a camera ray through pixel (x, y) meets the ellipsoid, or null: body-fixed kilometres. */
function intersect(camera: SpiceCamera, radii: readonly number[], x: number, y: number) {
  const m = camera.rayMatrix, d = [m[0][0] * x + m[0][1] * y + m[0][2], m[1][0] * x + m[1][1] * y + m[1][2], m[2][0] * x + m[2][1] * y + m[2][2]];
  const p = camera.positionKm, s = radii.map(r => 1 / (r * r));
  const a = d[0] * d[0] * s[0] + d[1] * d[1] * s[1] + d[2] * d[2] * s[2], b = 2 * (p[0] * d[0] * s[0] + p[1] * d[1] * s[1] + p[2] * d[2] * s[2]), c = p[0] * p[0] * s[0] + p[1] * p[1] * s[1] + p[2] * p[2] * s[2] - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 ? [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]] : null;
}
const normalAt = (point: readonly number[], radii: readonly number[]) => { const n = point.map((v, i) => v / (radii[i] * radii[i])); const l = Math.hypot(...n); return n.map(v => v / l); };

/** A camera moved by whole-image pixel offsets: a translation of the image plane, exact to well under a pixel for the two-degree offsets here. */
export function shiftCamera(camera: SpiceCamera, dx: number, dy: number): SpiceCamera {
  const m = camera.matrix, matrix = [m[0].map((v, i) => v + dx * m[2][i]), m[1].map((v, i) => v + dy * m[2][i]), [...m[2]]];
  const r = camera.rayMatrix, rayMatrix = r.map(row => [row[0], row[1], row[2] - row[0] * dx - row[1] * dy]);
  return { ...camera, matrix, rayMatrix };
}

/** The lit-disc model over a canvas that extends the frame by the search range: cos(incidence) where lit, 0 elsewhere, 2x2 supersampled. */
function litModel(camera: SpiceCamera, radii: readonly number[], padX: number, padY: number) {
  const w = WIDTH + 2 * padX, h = BAND_LINES + 2 * padY, model = new Float32Array(w * h);
  let lit = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0;
    for (const [ox, oy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const point = intersect(camera, radii, x - padX + ox, y - padY + oy);
      if (point) sum += Math.max(0, dot(normalAt(point, radii), camera.sunDirection));
    }
    model[y * w + x] = sum / 4; if (sum > 0) lit++;
  }
  return { model, w, h, lit: lit };
}

/** Median-filtered, clipped frame for registration: hot spots and particle hits must not steer the fit. */
function registrationImage(values: Float32Array) {
  const out = new Float32Array(values.length), window: number[] = [];
  for (let y = 0; y < BAND_LINES; y++) for (let x = 0; x < WIDTH; x++) {
    window.length = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < WIDTH && yy < BAND_LINES) window.push(values[yy * WIDTH + xx]); }
    window.sort((a, b) => a - b); out[y * WIDTH + x] = window[window.length >> 1];
  }
  const sorted = Array.from(out).sort((a, b) => a - b), clip = sorted[Math.floor(0.995 * (sorted.length - 1))];
  for (let i = 0; i < out.length; i++) out[i] = Math.min(out[i], clip);
  return out;
}

/** Normalized correlation of the frame with the model window at every offset in the search box; the best offset refined to sub-pixel by a parabola. */
export function correlate(image: Float32Array, model: Float32Array, w: number, padX: number, padY: number) {
  const n = WIDTH * BAND_LINES; let meanI = 0; for (let i = 0; i < n; i++) meanI += image[i]; meanI /= n;
  let varI = 0; for (let i = 0; i < n; i++) varI += (image[i] - meanI) ** 2;
  const score = (dx: number, dy: number) => {
    let sm = 0, smm = 0, sim = 0;
    for (let y = 0; y < BAND_LINES; y++) { const row = (y + padY - dy) * w + padX - dx; for (let x = 0; x < WIDTH; x++) { const m = model[row + x], v = image[y * WIDTH + x]; sm += m; smm += m * m; sim += v * m; } }
    const varM = smm - sm * sm / n;
    return varM > 0 ? (sim - meanI * sm) / Math.sqrt(varI * varM) : -1;
  };
  let best = { dx: 0, dy: 0, r: -Infinity };
  for (let dy = -padY; dy <= padY; dy += 2) for (let dx = -padX; dx <= padX; dx += 2) { const r = score(dx, dy); if (r > best.r) best = { dx, dy, r }; }
  const coarse = best;
  for (let dy = coarse.dy - 2; dy <= coarse.dy + 2; dy++) for (let dx = coarse.dx - 2; dx <= coarse.dx + 2; dx++) {
    if (Math.abs(dx) > padX || Math.abs(dy) > padY) continue; const r = score(dx, dy); if (r > best.r) best = { dx, dy, r };
  }
  const parabola = (a: number, b: number, c: number) => { const d = a - 2 * b + c; return d < 0 ? 0.5 * (a - c) / d : 0; };
  const inside = (dx: number, dy: number) => Math.abs(dx) <= padX && Math.abs(dy) <= padY;
  const fx = inside(best.dx - 1, best.dy) && inside(best.dx + 1, best.dy) ? parabola(score(best.dx - 1, best.dy), best.r, score(best.dx + 1, best.dy)) : 0;
  const fy = inside(best.dx, best.dy - 1) && inside(best.dx, best.dy + 1) ? parabola(score(best.dx, best.dy - 1), best.r, score(best.dx, best.dy + 1)) : 0;
  return { dx: best.dx + fx, dy: best.dy + fy, correlation: best.r, atSearchEdge: Math.abs(best.dx) === padX || Math.abs(best.dy) === padY };
}

interface FrameResult { productId: string; visit: string; utc: string; rangeKm: number; phaseDegrees: number; unit: string; litPixels: number; sunlitRadiance?: number;
  background?: { columns: number; median: number | null; maximum: number | null };
  registration: { method: 'lit-disc' | 'rejected'; dx: number; dy: number; correlation: number; reason?: string };
  camera: SpiceCamera; values: Float32Array }

/** The median of radiance / cos(incidence) over sunlit, near-nadir pixels: reflected sunlight normalised for illumination, a
 * quantity that should agree between visits at nearly the same heliocentric distance. It is how the archive's two stated
 * units were compared. */
function sunlitRadiance(frame: FrameResult, radii: readonly number[]) {
  const ratios: number[] = [];
  for (let y = 0; y < BAND_LINES; y++) for (let x = 0; x < WIDTH; x++) {
    const point = intersect(frame.camera, radii, x, y);
    if (!point) continue;
    const n = normalAt(point, radii), toCamera = frame.camera.positionKm.map((v, i) => v - point[i]), mu = dot(n, toCamera) / Math.hypot(...toCamera), mu0 = dot(n, frame.camera.sunDirection);
    if (mu0 > 0.7 && mu > 0.7 && Number.isFinite(frame.values[y * WIDTH + x])) ratios.push(frame.values[y * WIDTH + x] / mu0);
  }
  return ratios.length >= 20 ? median(ratios) : undefined;
}

/** Project one registered frame onto the map grid: cells on the recipe's side seen within the emission limit, nearest pixel. */
export function projectFrame(frame: { camera: Pick<SpiceCamera, 'matrix' | 'positionKm' | 'sunDirection'>; values: Float32Array }, radii: readonly number[], ppd: number, side: JiramRecipe['side'], policy: Pick<JiramRecipe['policy'], 'maximumEmissionDegrees' | 'maximumIncidenceDegrees' | 'terminatorFootprints'>, ifov: number, meanRadius: number) {
  const width = 360 * ppd, height = 180 * ppd, camera = frame.camera, values = new Float32Array(width * height).fill(NaN), footprint = new Float32Array(width * height).fill(NaN);
  const cosEmission = Math.cos(policy.maximumEmissionDegrees * Math.PI / 180), cosIncidence = Math.cos((policy.maximumIncidenceDegrees ?? 90) * Math.PI / 180);
  for (let row = 0; row < height; row++) {
    const lat = (90 - (row + 0.5) / ppd) * Math.PI / 180;
    for (let col = 0; col < width; col++) {
      const lon = ((col + 0.5) / ppd) * Math.PI / 180; // east longitude from 0
      // Planetocentric direction to the ellipsoid surface.
      const u = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
      const r = 1 / Math.sqrt(u[0] ** 2 / radii[0] ** 2 + u[1] ** 2 / radii[1] ** 2 + u[2] ** 2 / radii[2] ** 2), p = u.map(v => v * r), n = normalAt(p, radii);
      const toCamera = [camera.positionKm[0] - p[0], camera.positionKm[1] - p[1], camera.positionKm[2] - p[2]], range = Math.hypot(...toCamera);
      const mu = dot(n, toCamera) / range;
      if (mu < cosEmission) continue;
      const pixelKm = range * ifov, terminator = Math.asin(Math.min(1, policy.terminatorFootprints * pixelKm / mu / meanRadius));
      const mu0 = dot(n, camera.sunDirection);
      if (side === 'night' ? mu0 > -Math.sin(terminator) : mu0 < Math.max(Math.sin(terminator), cosIncidence)) continue; // the other side, or within the terminator's blur
      const m = camera.matrix, h = [0, 1, 2].map(k => m[k][0] * p[0] + m[k][1] * p[1] + m[k][2] * p[2] + m[k][3]);
      const x = Math.round(h[0] / h[2]), y = Math.round(h[1] / h[2]);
      if (!(h[2] > 0) || x < 1 || y < 1 || x >= WIDTH - 1 || y >= BAND_LINES - 1) continue;
      values[row * width + col] = frame.values[y * WIDTH + x]; footprint[row * width + col] = pixelKm / mu;
    }
  }
  return { values, footprint };
}

const median = (list: number[]) => { list.sort((a, b) => a - b); const m = list.length >> 1; return list.length % 2 ? list[m] : (list[m - 1] + list[m]) / 2; };

/** Estimate the additive column background from cold night-side samples. Localised hot spots occupy a minority of a
 * column; the median leaves their excess radiance intact. Never infer a background from illuminated pixels, interpolate
 * between columns, or clamp negative residuals. Columns without enough samples remain missing. */
export function subtractColumnBackground(values: Float32Array, night: Uint8Array, minimumSamples: number) {
  if (values.length !== WIDTH * BAND_LINES || night.length !== values.length || !Number.isInteger(minimumSamples) || minimumSamples < 1 || minimumSamples > BAND_LINES) throw new Error('Invalid JIRAM column-background inputs.');
  const corrected = new Float32Array(values.length).fill(NaN), offsets = new Float32Array(WIDTH).fill(NaN), counts = new Uint16Array(WIDTH);
  for (let x = 0; x < WIDTH; x++) {
    const samples: number[] = [];
    for (let y = 0; y < BAND_LINES; y++) { const i = y * WIDTH + x; if (night[i] && Number.isFinite(values[i])) samples.push(values[i]); }
    counts[x] = samples.length;
    if (samples.length < minimumSamples) continue;
    const offset = median(samples); offsets[x] = offset;
    for (let y = 0; y < BAND_LINES; y++) { const i = y * WIDTH + x; corrected[i] = values[i] - offset; }
  }
  return { values: corrected, offsets, counts };
}

/** Only use observed night-side pixels satisfying the map's emission and terminator margins. The cold surface is below
 * JIRAM's sensitivity (Mura et al. 2024, §4.2); illuminated terrain and off-body reflections cannot set this baseline. */
function nightBackgroundMask(camera: SpiceCamera, radii: readonly number[], policy: JiramRecipe['policy'], ifov: number, meanRadius: number) {
  const night = new Uint8Array(WIDTH * BAND_LINES), cosEmission = Math.cos(policy.maximumEmissionDegrees * Math.PI / 180);
  for (let y = 0; y < BAND_LINES; y++) for (let x = 0; x < WIDTH; x++) {
    const point = intersect(camera, radii, x, y);
    if (!point) continue;
    const normal = normalAt(point, radii), toCamera = camera.positionKm.map((v, i) => v - point[i]), range = Math.hypot(...toCamera), mu = dot(normal, toCamera) / range;
    if (mu < cosEmission) continue;
    const margin = Math.min(1, policy.terminatorFootprints * range * ifov / mu / meanRadius);
    if (dot(normal, camera.sunDirection) <= -margin) night[y * WIDTH + x] = 1;
  }
  return night;
}

/** Per-visit medians, then the finest visit per cell. */
export function combine(visits: { id: string; projections: { values: Float32Array; footprint: Float32Array }[] }[], cells: number, minimumFrames: number) {
  const out = new Float32Array(cells).fill(NaN), best = new Float32Array(cells).fill(Infinity), source = new Int16Array(cells).fill(-1), perVisit: Float32Array[] = [];
  visits.forEach((visit, index) => {
    const visitMap = new Float32Array(cells).fill(NaN);
    for (let c = 0; c < cells; c++) {
      const v: number[] = [], f: number[] = [];
      for (const p of visit.projections) if (Number.isFinite(p.values[c])) { v.push(p.values[c]); f.push(p.footprint[c]); }
      if (v.length < minimumFrames) continue;
      const value = median(v), size = median(f); visitMap[c] = value;
      if (size < best[c]) { best[c] = size; out[c] = value; source[c] = index; }
    }
    perVisit.push(visitMap);
  });
  return { map: out, footprint: best, source, perVisit };
}

/** Restore the declared native image and label; validate their identity and layout before caching them.
 * Source byte identities belong to the measured receipt, not the authored recipe. */
export async function readArchivedFrame(recipe: JiramRecipe, frame: JiramFrame, directory: string, fetchMissing: boolean, fetcher: typeof fetch = fetch) {
  const read = async (name: string) => {
    const path = resolve(directory, name);
    let bytes = await readFile(path).catch(() => undefined);
    if (!bytes && fetchMissing) {
      const response = await fetcher(`${recipe.archive}/${frame.volume}/DATA/${name}`);
      if (!response.ok) throw new Error(`${name}: archive answered ${response.status}.`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (!bytes) throw new Error(`${name} is missing from ${directory}; run with --fetch.`);
    return bytes;
  };
  const [image, label] = await Promise.all([read(`${frame.productId}.IMG`), read(`${frame.productId}.LBL`)]);
  const text = label.toString('latin1');
  if (pds3Keyword(text, 'PRODUCT_ID') !== frame.productId || pds3Keyword(text, 'DATA_SET_ID') !== 'JNO-J-JIRAM-3-RDR-V1.0') throw new Error(`${frame.productId}: archive product identity differs from the recipe.`);
  decodeFrame(image, text, recipe);
  await mkdir(directory, { recursive: true });
  await Promise.all([writeFile(resolve(directory, `${frame.productId}.IMG`), image), writeFile(resolve(directory, `${frame.productId}.LBL`), label)]);
  return [image, label] as const;
}

/** The matching EDR supplies detector DN before radiometric calibration. Withhold non-linear pixels using the
 * published limit, rather than trying to recover a DN threshold from calibrated RDR radiance. */
export function detectorMask(bytes: Buffer, label: string, rdrLabel: string, recipe: Pick<JiramRecipe, 'band'>, maximumDn: number) {
  const id = (pds3Keyword(rdrLabel, 'SOURCE_PRODUCT_ID') ?? '').replace(/\.IMG$/u, '');
  const lines = Number(pds3Keyword(label, 'LINES'));
  const layout = lines === 128 || lines === 256 ? recipe.band.frameLines[lines === 128 ? '128' : '256'] : undefined;
  if (!/^JIR_IMG_EDR_\d{7}T\d{6}_V\d{2}$/u.test(id) || pds3Keyword(label, 'PRODUCT_ID') !== id ||
      pds3Keyword(label, 'DATA_SET_ID') !== 'JNO-J-JIRAM-2-EDR-V1.0' || pds3Keyword(label, 'DATA_QUALITY_ID') !== '1' ||
      pds3Keyword(label, 'SAMPLE_TYPE') !== 'LSB_INTEGER' || pds3Keyword(label, 'SAMPLE_BITS') !== '16' ||
      Number(pds3Keyword(label, 'LINE_SAMPLES')) !== WIDTH || !layout || bytes.length !== WIDTH * lines * 2 ||
      ['START_TIME', 'STOP_TIME', 'EXPOSURE_DURATION', 'INSTRUMENT_MODE_ID'].some(key => !pds3Keyword(label, key) || pds3Keyword(label, key) !== pds3Keyword(rdrLabel, key))) {
    throw new Error('JIRAM EDR identity, exposure or detector layout differs from its RDR.');
  }
  const mask = new Uint8Array(WIDTH * BAND_LINES);
  for (let i = 0; i < mask.length; i++) mask[i] = bytes.readInt16LE((layout.firstLine * WIDTH + i) * 2) >= maximumDn ? 1 : 0;
  return mask;
}

async function readDetectorMask(recipe: JiramRecipe, frame: JiramFrame, rdrLabel: string, directory: string, fetchMissing: boolean, maximumDn: number) {
  const productId = frame.productId.replace('_RDR_', '_EDR_'), volume = frame.volume.replace('jnojir_2', 'jnojir_1');
  const buffers: Buffer[] = [];
  for (const ext of ['IMG', 'LBL']) {
    const name = `${productId}.${ext}`, path = resolve(directory, name);
    let bytes = await readFile(path).catch(() => undefined);
    if (!bytes && fetchMissing) {
      const response = await fetch(`${recipe.archive}/${volume}/DATA/${name}`);
      if (!response.ok) throw new Error(`${name}: archive answered ${response.status}.`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (!bytes) throw new Error(`${name} is missing; run with --fetch.`);
    buffers.push(bytes);
  }
  const [image, label] = buffers;
  const mask = detectorMask(image, label.toString('latin1'), rdrLabel, recipe, maximumDn);
  await Promise.all([writeFile(resolve(directory, `${productId}.IMG`), image), writeFile(resolve(directory, `${productId}.LBL`), label)]);
  return {mask, productId, volume, maximumDn, withheldPixels: mask.reduce((n,v)=>n+v,0)};
}

export async function runMosaic(recipePath: string, framesDirectory: string, fetchMissing = false, previews?: string) {
  const root = dirname(recipePath), recipe = parseRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  const ppd = recipe.output.pixelsPerDegree, cells = 360 * ppd * 180 * ppd, padX = recipe.policy.searchCrossTrackPixels, padY = recipe.policy.searchAlongTrackPixels;
  const frames: FrameResult[] = [], inputs: {productId: string; volume: string}[] = [];
  const detectorChecks: Omit<Awaited<ReturnType<typeof readDetectorMask>>, 'mask'>[] = [];
  let radii: number[] = [], ifov = 0;
  for (const visit of recipe.visits) {
    const paths = await kernelBankPaths(recipe.kernelSet, [...recipe.commonKernels, ...visit.kernels]);
    const set: KernelSet = await loadKernelSet(paths);
    radii = numbers(set.pool, `BODY${recipe.target.naifId}_RADII`); ifov = numbers(set.pool, `INS${recipe.band.instrument}_IFOV`)[0];
    for (const archived of visit.frames) {
      const [bytes, labelBytes] = await readArchivedFrame(recipe, archived, framesDirectory, fetchMissing);
      inputs.push({productId: archived.productId, volume: archived.volume});
      const label = labelBytes.toString('latin1'), decoded = decodeFrame(bytes, label, recipe);
      const scale = recipe.unitScale[decoded.unit];
      if (scale === undefined) throw new Error(`${archived.productId}: no stated scale for the archived unit ${decoded.unit}.`);
      const values = decoded.values.map(v => v * scale);
      const registrationValues = values.slice();
      if (visit.maximumDetectorDn !== undefined) {
        const {mask, ...record} = await readDetectorMask(recipe, archived, label, framesDirectory, fetchMissing, visit.maximumDetectorDn);
        detectorChecks.push(record);
        for (let i = 0; i < values.length; i++) if (mask[i]) values[i] = NaN;
      }
      const et = (utcToEt(set.leapSeconds, `${decoded.start}Z`) + utcToEt(set.leapSeconds, `${decoded.stop}Z`)) / 2;
      const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: JUNO, target: recipe.target.naifId, bodyFrame: recipe.target.bodyFrame, instrument: recipe.band.instrument, et, aberration: 'LT+S', pixels: recipe.band.pixels });
      const { model, w, lit } = litModel(camera, radii, padX, padY);
      const base = { productId: archived.productId, visit: visit.id, utc: decoded.start, rangeKm: camera.report.rangeKm, phaseDegrees: camera.report.phaseAngleDegrees, unit: decoded.unit, litPixels: lit, values };
      if (lit < recipe.policy.minimumLitPixels) { frames.push({ ...base, camera, registration: { method: 'rejected', dx: 0, dy: 0, correlation: NaN, reason: 'too little sunlit disc in the search window' } }); continue; }
      const fit = correlate(registrationImage(registrationValues), model, w, padX, padY);
      const accepted = fit.correlation >= recipe.policy.minimumCorrelation && !fit.atSearchEdge;
      frames.push({ ...base, camera: accepted ? shiftCamera(camera, fit.dx, fit.dy) : camera,
        registration: accepted ? { method: 'lit-disc', dx: fit.dx, dy: fit.dy, correlation: fit.correlation }
          : { method: 'rejected', dx: fit.dx, dy: fit.dy, correlation: fit.correlation, reason: fit.atSearchEdge ? 'best offset at the search edge' : 'correlation below the policy' } });
      console.error(`${archived.productId} lit ${lit} dx ${fit.dx.toFixed(2)} dy ${fit.dy.toFixed(2)} r ${fit.correlation.toFixed(3)}${accepted ? '' : ' REJECTED'}`);
    }
  }
  const meanRadius = (radii[0] * radii[1] * radii[2]) ** (1 / 3);
  const build = (use: (f: FrameResult) => boolean) => combine(recipe.visits.map(v => ({ id: v.id,
    projections: frames.filter(f => f.visit === v.id && use(f)).map(f => projectFrame(f, radii, ppd, recipe.side, recipe.policy, ifov, meanRadius)) })), cells, recipe.policy.minimumFramesPerVisit);
  for (const visit of recipe.visits) {
    const fitted = frames.filter(f => f.visit === visit.id && f.registration.method === 'lit-disc');
    if (!fitted.length) continue;
    const dx = median(fitted.map(f => f.registration.dx)), dy = median(fitted.map(f => f.registration.dy));
    for (const frame of fitted) {
      if (Math.max(Math.abs(frame.registration.dx - dx), Math.abs(frame.registration.dy - dy)) <= recipe.policy.maximumVisitOffsetPixels) continue;
      frame.registration = { ...frame.registration, method: 'rejected', reason: `offset ${Math.round(frame.registration.dx)}, ${Math.round(frame.registration.dy)} disagrees with the visit's ${Math.round(dx)}, ${Math.round(dy)}` };
    }
  }
  for (const frame of frames) if (frame.registration.method === 'lit-disc') {
    frame.sunlitRadiance = sunlitRadiance(frame, radii);
    if (recipe.background) {
      const result = subtractColumnBackground(frame.values, nightBackgroundMask(frame.camera, radii, recipe.policy, ifov, meanRadius), recipe.background.minimumSamples);
      const offsets = Array.from(result.offsets).filter(Number.isFinite).sort((a, b) => a - b);
      frame.background = { columns: offsets.length, median: offsets.length ? median(offsets) : null, maximum: offsets.at(-1) ?? null };
      frame.values = result.values;
    }
  }
  const final = build(f => f.registration.method !== 'rejected');
  await writeMap(root, recipe, final.map);
  const covered = final.map.reduce((n, v) => n + (Number.isFinite(v) ? 1 : 0), 0);
  const receipt = { schema: RECEIPT_SCHEMA, recipe: recipe.output.productId, side: recipe.side, inputs, detectorChecks, radiiKm: radii, ifovRadians: ifov,
    coverage: { cells, [`${recipe.side}Cells`]: covered, fraction: covered / cells },
    visits: recipe.visits.map((v, i) => ({ id: v.id, frames: frames.filter(f => f.visit === v.id).length, winningCells: final.source.reduce((n, s) => n + (s === i ? 1 : 0), 0) })),
    frames: frames.map(f => ({ productId: f.productId, visit: f.visit, utc: f.utc, unit: f.unit, rangeKm: Math.round(f.rangeKm), phaseDegrees: +f.phaseDegrees.toFixed(2), litPixels: f.litPixels, sunlitRadiance: f.sunlitRadiance === undefined ? null : +f.sunlitRadiance.toPrecision(4),
      ...(f.background ? { background: f.background } : {}),
      registration: { ...f.registration, dx: +f.registration.dx.toFixed(2), dy: +f.registration.dy.toFixed(2), correlation: +f.registration.correlation.toFixed(4) } })) };
  await writeFile(resolve(root, recipe.output.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  if (previews) await writePreviews(previews, frames, radii, final, ppd);
  return receipt;
}

// The producer each JIRAM map label names in its "Written by ..." note.
export const JIRAM_MOSAIC_PRODUCER = 'packages/bake/authoring/juno/jiram-mosaic.mts';
export const JIRAM_REGISTERED_MOSAIC_PRODUCER = 'packages/bake/authoring/juno/jiram-registered-mosaic.mts';

/** PDS3 simple cylindrical map, east-positive planetocentric, 0 to 360 east, little-endian floats, detached label. */
export async function writeMap(root: string, recipe: Pick<JiramRecipe, 'output' | 'side' | 'background'> & {
  target: Pick<JiramRecipe['target'], 'name' | 'referenceRadiusKm'>; band: Pick<JiramRecipe['band'], 'name' | 'unit'>;
  visits: readonly { frames: readonly unknown[] }[];
}, map: Float32Array, producer = JIRAM_MOSAIC_PRODUCER) {
  const ppd = recipe.output.pixelsPerDegree, width = 360 * ppd, height = 180 * ppd, missing = -1e32, bytes = Buffer.alloc(width * height * 4);
  for (let i = 0; i < map.length; i++) bytes.writeFloatLE(Number.isFinite(map[i]) ? map[i] : missing, i * 4);
  const name = recipe.output.image.split('/').pop()!;
  const label = [
    'PDS_VERSION_ID = PDS3', 'RECORD_TYPE = FIXED_LENGTH', `RECORD_BYTES = ${width * 4}`, `FILE_RECORDS = ${height}`, `^IMAGE = "${name}"`,
    `DATA_SET_ID = "CSSEARTH-${recipe.target.name}-JIRAM-${recipe.band.name}-${recipe.side.toUpperCase()}-MOSAIC-V1"`, `PRODUCT_ID = "${recipe.output.productId}"`, `TARGET_NAME = "${recipe.target.name}"`,
    'SOURCE_DATA_SET_ID = "JNO-J-JIRAM-3-RDR-V1.0"', `SOURCE_PRODUCT_COUNT = ${recipe.visits.reduce((n, v) => n + v.frames.length, 0)}`,
    `NOTE = "${recipe.side === 'night' ? 'Night' : 'Day'}-side JIRAM ${recipe.band.name}-band band radiance${recipe.background ? ' above per-column cold-night background' : ''}: per-visit medians, finest visit per cell. Written by ${producer}."`,
    'OBJECT = IMAGE', `  LINES = ${height}`, `  LINE_SAMPLES = ${width}`, '  SAMPLE_TYPE = PC_REAL', '  SAMPLE_BITS = 32', `  UNIT = "${recipe.band.unit}"`,
    '  SCALING_FACTOR = 1', '  OFFSET = 0', `  MISSING_CONSTANT = ${missing.toExponential()}`, 'END_OBJECT = IMAGE',
    'OBJECT = IMAGE_MAP_PROJECTION', '  MAP_PROJECTION_TYPE = "EQUIRECTANGULAR"', '  COORDINATE_SYSTEM_NAME = "PLANETOCENTRIC"', '  COORDINATE_SYSTEM_TYPE = "BODY-FIXED ROTATING"',
    '  POSITIVE_LONGITUDE_DIRECTION = "EAST"', ...['A', 'B', 'C'].map(axis => `  ${axis}_AXIS_RADIUS = ${recipe.target.referenceRadiusKm} <KM>`),
    '  CENTER_LATITUDE = 0', '  CENTER_LONGITUDE = 180', '  MAXIMUM_LATITUDE = 90', '  MINIMUM_LATITUDE = -90', '  EASTERNMOST_LONGITUDE = 360', '  WESTERNMOST_LONGITUDE = 0',
    `  MAP_RESOLUTION = ${ppd} <PIX/DEG>`, `  SAMPLE_PROJECTION_OFFSET = ${180 * ppd - 0.5}`, `  LINE_PROJECTION_OFFSET = ${90 * ppd - 0.5}`, '  MAP_PROJECTION_ROTATION = 0.0 <degree>',
    'END_OBJECT = IMAGE_MAP_PROJECTION', 'END', ''].join('\r\n');
  await mkdir(dirname(resolve(root, recipe.output.image)), { recursive: true });
  await writeFile(resolve(root, recipe.output.image), bytes); await writeFile(resolve(root, recipe.output.label), label);
}

/** Scratch previews: every lit-registered frame with its fitted limb and terminator, and the map on the paper's 0–0.15 scale. */
async function writePreviews(directory: string, frames: FrameResult[], radii: readonly number[], final: ReturnType<typeof combine>, ppd: number) {
  await mkdir(directory, { recursive: true });
  for (const frame of frames) {
    const sorted = Array.from(frame.values).filter(Number.isFinite).sort((a, b) => a - b);
    const top = sorted[Math.floor(0.998 * (sorted.length - 1))] || 1, rgb = Buffer.alloc(WIDTH * BAND_LINES * 3);
    for (let i = 0; i < frame.values.length; i++) { const v = Math.round(255 * Math.sqrt(Math.max(0, Math.min(1, frame.values[i] / top)))); rgb.fill(v, i * 3, i * 3 + 3); }
    for (let y = 0; y < BAND_LINES; y++) for (let x = 0; x < WIDTH; x++) {
      const here = intersect(frame.camera, radii, x, y), right = intersect(frame.camera, radii, x + 1, y), below = intersect(frame.camera, radii, x, y + 1);
      if (!here !== !right || !here !== !below) rgb[(y * WIDTH + x) * 3] = 255;
      else if (here && right && Math.sign(dot(normalAt(here, radii), frame.camera.sunDirection)) !== Math.sign(dot(normalAt(right, radii), frame.camera.sunDirection))) rgb[(y * WIDTH + x) * 3 + 2] = 255;
    }
    await sharp(rgb, { raw: { width: WIDTH, height: BAND_LINES, channels: 3 } }).resize(WIDTH * 2, BAND_LINES * 2, { kernel: 'nearest' }).png().toFile(resolve(directory, `${frame.visit}-${frame.productId}-${frame.registration.method}.png`));
  }
  // Each visit's own median map, as raw little-endian floats (NaN where unseen), for comparison with per-orbit figures.
  await Promise.all(final.perVisit.map((map, i) => writeFile(resolve(directory, `visit-${i}.f32`), Buffer.from(map.buffer, map.byteOffset, map.byteLength))));
  const width = 360 * ppd, height = 180 * ppd, rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const v = final.map[i];
    if (!Number.isFinite(v)) { rgb.fill(40, i * 3, i * 3 + 3); continue; }
    const t = Math.max(0, Math.min(1, v / 0.15)); rgb[i * 3] = Math.round(255 * Math.min(1, t * 3)); rgb[i * 3 + 1] = Math.round(255 * Math.max(0, Math.min(1, t * 3 - 1))); rgb[i * 3 + 2] = Math.round(255 * Math.max(0.2, Math.min(1, t * 3 - 2)));
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(width * 2, height * 2, { kernel: 'nearest' }).png().toFile(resolve(directory, 'map.png'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2), [recipe] = positionalArguments(args, ['--previews', '--frames']), frames = flagValue(args, '--frames');
  if (!recipe || !frames) throw new Error('Usage: node packages/bake/authoring/juno/jiram-mosaic.mts <recipe.json> --frames <directory> [--fetch] [--previews <directory>]');
  const preview = flagValue(args, '--previews');
  const receipt = await runMosaic(resolve(recipe), resolve(frames), args.includes('--fetch'), preview === undefined ? undefined : resolve(preview));
  console.log(JSON.stringify({ coverage: receipt.coverage, visits: receipt.visits }, null, 2));
}
