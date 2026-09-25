/**
 * Earth's limb law measured from DSCOVR EPIC Level 1B frames: one Minnaert coefficient per colour channel (680, 551
 * and 443 nm), fitted to the whole sunlit disc as EPIC sees it from L1, clouds and atmosphere included. Each frame's
 * pixels are binned by the cosines of their Sun and view zenith angles; a bin's median brightness damps clouds and
 * glint, and the Minnaert law ln I = ln I0 + k ln mu0 + (k - 1) ln mu is fitted to the bin medians, weighted by pixel
 * count. The calibration factor cancels because the law is relative to the disc centre. Preparation only.
 *
 *   node tools/photometry/fit-epic-limb.mts --files=a.h5,b.h5,... [--write]
 *
 * A file may be the whole L1B frame or a subset holding the same dataset paths (the three bands' Image and Earth
 * Sun/View zenith and azimuth), read by byte range from https://avdc.gsfc.nasa.gov/pub/DSCOVR/Level1b_v03/; a subset
 * named <frame>.subset.h5 is reported under its frame's name.
 *
 * Prints each frame's fit; --write stores the three model records under src/objects/earth/source/photometry/ and the
 * per-bin evidence under src/objects/earth/evidence/epic-limb-fit.json.
 */
import * as h5 from 'h5wasm/node';
import { writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { PHOTOMETRIC_MODEL_SCHEMA } from './model-record.mts';

const BANDS = [{ band: '680', channel: 'red' }, { band: '551', channel: 'green' }, { band: '443', channel: 'blue' }] as const;
const STEP = 0.05, MINIMUM_COSINE = 0.1, MINIMUM_PIXELS = 200;

function numbers(file: h5.File, path: string): Float32Array {
  const dataset = file.get(path);
  if (!(dataset instanceof h5.Dataset)) throw new TypeError(`${file.filename}: missing dataset ${path}.`);
  const value = dataset.value;
  if (!(value instanceof Float32Array)) throw new TypeError(`${file.filename}: ${path} is not float32 (${dataset.dtype}).`);
  return value;
}
const median = (values: number[]) => { values.sort((a, b) => a - b); const middle = values.length >> 1; return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2; };

interface BinFit { mu0: number; mu: number; pixels: number; median: number; residual: number }
interface FrameFit { file: string; band: string; channel: string; phaseDegrees: [number, number]; k: number; intercept: number; rmsResidual: number; bins: BinFit[] }

function fitFrame(file: h5.File, band: string, channel: string): FrameFit {
  const base = `Band${band}nm`, image = numbers(file, `${base}/Image`);
  const sun = numbers(file, `${base}/Geolocation/Earth/SunAngleZenith`), view = numbers(file, `${base}/Geolocation/Earth/ViewAngleZenith`);
  const sunAzimuth = numbers(file, `${base}/Geolocation/Earth/SunAngleAzimuth`), viewAzimuth = numbers(file, `${base}/Geolocation/Earth/ViewAngleAzimuth`);
  const cells = Math.round(1 / STEP), bins: number[][] = Array.from({ length: cells * cells }, () => []);
  let phaseLow = Infinity, phaseHigh = -Infinity;
  const radians = Math.PI / 180;
  for (let index = 0; index < image.length; index++) {
    const value = image[index], i = sun[index], e = view[index];
    if (!Number.isFinite(value) || !(value > 0) || !Number.isFinite(i) || !Number.isFinite(e) || i >= 90 || e >= 90) continue;
    const mu0 = Math.cos(i * radians), mu = Math.cos(e * radians);
    const cosPhase = mu0 * mu + Math.sin(i * radians) * Math.sin(e * radians) * Math.cos((sunAzimuth[index] - viewAzimuth[index]) * radians);
    const phase = Math.acos(Math.max(-1, Math.min(1, cosPhase))) / radians;
    if (Number.isFinite(phase)) { phaseLow = Math.min(phaseLow, phase); phaseHigh = Math.max(phaseHigh, phase); }
    bins[Math.min(cells - 1, Math.floor(mu0 / STEP)) * cells + Math.min(cells - 1, Math.floor(mu / STEP))].push(value);
  }
  const used: { mu0: number; mu: number; pixels: number; median: number }[] = [];
  bins.forEach((values, cell) => {
    const mu0 = (Math.floor(cell / cells) + 0.5) * STEP, mu = (cell % cells + 0.5) * STEP;
    if (values.length >= MINIMUM_PIXELS && mu0 >= MINIMUM_COSINE && mu >= MINIMUM_COSINE) used.push({ mu0, mu, pixels: values.length, median: median(values) });
  });
  if (used.length < 5) throw new Error(`${basename(file.filename)} ${band} nm: only ${used.length} angle bins hold ${MINIMUM_PIXELS} pixels.`);
  // y = ln I + ln mu = ln I0 + k ln(mu0 mu), weighted by pixel count.
  let weight = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const bin of used) {
    const x = Math.log(bin.mu0 * bin.mu), y = Math.log(bin.median) + Math.log(bin.mu), w = bin.pixels;
    weight += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
  }
  const k = (weight * sxy - sx * sy) / (weight * sxx - sx * sx), intercept = (sy - k * sx) / weight;
  const fitted = used.map(bin => ({ ...bin, residual: Math.log(bin.median) - (intercept + k * Math.log(bin.mu0) + (k - 1) * Math.log(bin.mu)) }));
  const rms = Math.sqrt(fitted.reduce((sum, bin) => sum + bin.pixels * bin.residual ** 2, 0) / weight);
  return { file: basename(file.filename).replace(/\.subset\.h5$/u, '.h5'), band, channel, phaseDegrees: [phaseLow, phaseHigh], k, intercept, rmsResidual: rms, bins: fitted };
}

const files = (process.argv.find(value => value.startsWith('--files='))?.slice(8) ?? '').split(',').filter(Boolean);
if (!files.length) throw new TypeError('--files= names one or more EPIC L1B HDF5 frames.');
await h5.ready;
const fits: FrameFit[] = [];
for (const path of files) {
  const file = new h5.File(path, 'r');
  try { for (const { band, channel } of BANDS) { const fit = fitFrame(file, band, channel); fits.push(fit); console.log(`${fit.file} ${band} nm: k ${fit.k.toFixed(3)}, rms residual ${(fit.rmsResidual * 100).toFixed(1)}% over ${fit.bins.length} bins, phase ${fit.phaseDegrees.map(v => v.toFixed(1)).join('-')} deg`); } }
  finally { file.close(); }
}
const summary = BANDS.map(({ band, channel }) => {
  const ks = fits.filter(fit => fit.band === band).map(fit => fit.k), mean = ks.reduce((a, b) => a + b, 0) / ks.length;
  const spread = Math.sqrt(ks.reduce((sum, k) => sum + (k - mean) ** 2, 0) / Math.max(1, ks.length - 1));
  return { band, channel, k: Math.round(mean * 1000) / 1000, spread: Math.round(spread * 1000) / 1000, frames: ks.length };
});
console.log(summary);
if (process.argv.includes('--write')) {
  const root = process.cwd(), photometry = resolve(root, 'src/objects/earth/source/photometry'), evidence = resolve(root, 'src/objects/earth/evidence');
  await mkdir(photometry, { recursive: true }); await mkdir(evidence, { recursive: true });
  const phase = [Math.min(...fits.map(fit => fit.phaseDegrees[0])), Math.max(...fits.map(fit => fit.phaseDegrees[1]))].map(value => Math.round(value * 10) / 10);
  const emission = Math.round(Math.acos(MINIMUM_COSINE) * 1800 / Math.PI) / 10;
  for (const { band, k } of summary) await writeFile(resolve(photometry, `epic-minnaert-${band}nm.json`), JSON.stringify({
    schema: PHOTOMETRIC_MODEL_SCHEMA, id: `epic-minnaert-${band}nm`, instrument: 'DSCOVR EPIC', filter: `${band} nm`, quantity: 'radiance-factor',
    model: { family: 'separable', disk: { family: 'minnaert', coefficient: k, coefficientPerDegree: 0 } },
    fit: { phaseDegrees: phase, incidenceDegrees: [0, emission], emissionDegrees: [0, emission] },
  }, null, 2) + '\n');
  await writeFile(resolve(evidence, 'epic-limb-fit.json'), JSON.stringify({ tool: 'tools/photometry/fit-epic-limb.mts', binStep: STEP, minimumCosine: MINIMUM_COSINE, minimumPixels: MINIMUM_PIXELS, summary,
    frames: fits.map(fit => ({ ...fit, k: Math.round(fit.k * 10000) / 10000, bins: fit.bins.map(bin => ({ mu0: bin.mu0, mu: bin.mu, pixels: bin.pixels, residual: Math.round(bin.residual * 10000) / 10000 })) })) }, null, 1) + '\n');
  console.log('wrote the three records and the evidence');
}
