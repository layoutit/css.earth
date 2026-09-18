#!/usr/bin/env node
/** Betelgeuse's circumstellar dust, as two density grids the shared slab baker turns into one lens bank.
 *
 *   node tools/objects/source-authoring/betelgeuse-shell/author.mts [--check]
 *
 * --check recomputes every output and fails if any differs from the file on disk.
 *
 * **zimpol-v** is the measured one: the SPHERE/ZIMPOL V-band degree of linear polarisation of 3 December 2024 (ESO Phase 3
 * collection BETELGEUSE-B, Montargès et al. 2026). It is a sky-plane image with no third axis, so it is placed in the plane of
 * the sky through the star and spread along the line of sight by the Rayleigh polarisation efficiency r^2/(r^2+2z^2),
 * normalised so each column reproduces its measured degree. Depth is a stated convention, not a measurement.
 *
 * **veil-2019-12** is the published model: the RADMC-3D dusty clump Montargès et al. (2021, Nature 594, 365) fitted to the
 * Great Dimming, a sphere of constant density whose centre, radius and density are their Extended Data Table 3, in their own
 * coordinates (x along right ascension, y along declination, z positive toward Earth; Extended Data Figure 6). It is drawn as
 * starlight scattered by that dust: the published density weighted by the inverse-square illumination each parcel receives.
 *
 * Both grids share one frame anchored on Betelgeuse's prepared scene origin, so one volume unit is one stellar radius. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsImage } from '../../../fits.mts';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { encodeDensityKtx2 } from '../../../../src/preparation/volume/acquisition.ts';

const root = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse-shell/source');
const packageBase = 'src/objects/betelgeuse-shell/source';
/** The two publisher figures this package cites, kept beside it because preparation reads them for the dataset previews. */
export const PREVIEWS = Object.freeze({
  'zimpol-v': { path: 'previews/aa61023-26-fig3.jpg', url: 'https://www.aanda.org/articles/aa/full_html/2026/07/aa61023-26/aa61023-26-fig3.jpg',
    origin: 'https://doi.org/10.1051/0004-6361/202661023', sha256: '016094a65ecf21a125dc9e4f45625ecf4edf97ddfaa10cd9b955d64bb5cc3292', bytes: 323819,
    title: 'Degree of linear polarisation around Betelgeuse, V band, 3 December 2024',
    credit: 'Montarg\u00e8s et al. 2026, A&A 711, L12, Fig. B.1; ESO/VLT/SPHERE-ZIMPOL',
    license: 'CC-BY-4.0. Open access under the Creative Commons Attribution 4.0 International licence; retain the citation.' },
  'veil-2019-12': { path: 'previews/eso2109a.jpg', url: 'https://cdn.eso.org/images/screen/eso2109a.jpg',
    origin: 'https://www.eso.org/public/images/eso2109a/', sha256: 'dc91807cd8b41719cc7e4cc310c99082d9ad02c49a08b51155bb00be2d1fbf17', bytes: 45713,
    title: 'Betelgeuse\u2019s surface before and during its 2019\u20132020 Great Dimming',
    credit: 'ESO/M. Montarg\u00e8s et al.', crop: { left: 320, top: 40, width: 318, height: 520 },
    license: 'CC-BY-4.0. ESO images are released under the Creative Commons Attribution 4.0 International licence; retain the credit.' },
});
const starScene = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/prepared/scene.json');

/** The two V-band products as ESO serves them: the pipeline intensity and its ancillary degree of linear polarisation. */
export const PRODUCTS = Object.freeze({
  intensity: { path: 'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits', dpId: 'ADP.2026-08-19T13:19:07.655',
    sha256: 'b40cfcb32103c99c5de9f77588519bbb6c9322eb250d7bc9756339fee8abd8eb', bytes: 8458560 },
  dolp: { path: 'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits', dpId: 'ADP.2026-08-19T13:19:07.656',
    sha256: '0df320dc9406596a9e47e2633cb97ce5bbfe9db3a7a2f1a8fc2437efdf924687', bytes: 8455680 },
});
/** The ALMA SiO v=0 J=5-4 cube of 2 August 2023, cut out of the archive's own pipeline product around this star,
 * continuum-subtracted against its 1738 line-free channels and windowed to the line. This is the one dataset here whose
 * depth is measured rather than inferred from a projection: the line-of-sight velocity of each parcel places it. */
export const ALMA_SIO = Object.freeze({
  path: 'observations/betelgeuse-alma-sio-v0-5-4-2023-08.fits',
  sha256: 'daefd07d5e8ed872474df2b8d618b9b632b898faaae7146784e224e7897d4657', bytes: 616320,
  proposal: '2022.A.00026.S', member: 'uid://A001/X360d/Xae',
  product: 'member.uid___A001_X360d_Xae.Betelgeuse_sci.spw27.cube.regcal.I.pbcor.fits',
  /** The star's own velocity, read off the brightest channel of the envelope. */
  systemicKmS: 8,
  /** Measured here: the projected separation of this clump against Montarges et al. 2021's December 2019 clump, over
   * the 3.63 years between the two epochs. It is the only thing that sets the scale of the depth. */
  skySpeedKmS: 7.7,
  /** A parcel counts when its integrated line emission clears this many times the map noise. */
  detectionSigma: 5,
  /** A line of sight cannot be deprojected past the flow speed; this caps it so a parcel never runs to infinity. */
  maximumProjection: 0.85,
});
/** ALMA line maps have no publisher's palette the way the two optical datasets do, so this one carries the perceptual
 * ramp such maps are conventionally printed in, sampled at the quarters of its bar, and is marked false colour. */
export const SIO_MAP = Object.freeze({
  name: 'viridis',
  stops: Object.freeze([
    Object.freeze([0.231, 0.322, 0.545] as const), Object.freeze([0.129, 0.569, 0.549] as const),
    Object.freeze([0.369, 0.788, 0.384] as const), Object.freeze([0.992, 0.906, 0.145] as const),
  ]),
});
export function sioMapWeights(value: number): readonly [number, number, number, number] {
  const p = Math.max(0, Math.min(1, value)) * SIO_MAP.stops.length;
  return [0, 1, 2, 3].map(k => Math.max(0, 1 - Math.abs(p - (k + 1)))) as unknown as readonly [number, number, number, number];
}

/** Read a small 3-axis FITS cube: the header cards this needs, then big-endian float32 data. */
function readCube(bytes: Buffer) {
  const cards: string[] = []; let offset = 0;
  outer: for (; offset < bytes.length; offset += 2880) for (let i = 0; i < 2880; i += 80) {
    const card = bytes.toString('latin1', offset + i, offset + i + 80); cards.push(card);
    if (/^END\s*$/.test(card)) { offset += 2880; break outer; }
  }
  const number = (key: string) => {
    const card = cards.find(card => card.startsWith(key.padEnd(8)));
    if (!card) throw new Error(`The SiO cube declares no ${key}.`);
    return Number(card.slice(10, 30));
  };
  const width = number('NAXIS1'), height = number('NAXIS2'), channels = number('NAXIS3');
  const data = bytes.subarray(offset);
  return { width, height, channels, cards, number,
    at: (x: number, y: number, c: number) => data.readFloatBE(((c * height + y) * width + x) * 4) };
}

export const EMISSION_PREVIEW_PATH = 'previews/emission-2020-off-limb.png';
export const SIO_PREVIEW_PATH = 'previews/sio-2023-integrated-line.png';
export const PIXEL_SCALE_MAS = 3.6;
/** The 4 micrometre reconstruction this package's third dataset reads, the same bytes Betelgeuse's own package ships.
 * Only its light outside the photosphere is used; the disc itself is already the star's drawn sphere. */
export const EMISSION_2020 = Object.freeze({
  path: 'observations/betelgeuse-matisse-2020-02-continuum-4mas.fits',
  sha256: '43daead1f727fd2e5421bfa4e4dd1d8348f32c9e3e7171b79efe5ddfe645a5dd', bytes: 135360,
  /** The image states its own pixel in milliarcseconds, and the reconstruction is convolved to this beam. */
  pixelMas: 0.78, beamMas: 4,
  /** The published disc: 42.45 mas across. Inside it the sphere is drawn, and within one beam of it the light is the
   * star's own edge smeared by that beam, so neither belongs in a volume. */
  discDiameterMas: 42.45,
  /** The top of the drawn scale, as a fraction of the image's central brightness. */
  topOfCentral: 0.06,
});
/** One unit is one stellar radius. Six radii each way holds the 2024 patches and the 2019 clump, in twenty-four half-radius slabs. */
export const GRID = Object.freeze({ size: 96, halfUnits: 6, slabs: 24 });
/** Polarisation stretch: the median degree beyond eight radii is instrumental floor, and the top is the top of the
 * published colourbar, so this volume carries the same transfer function as the figure it reproduces. */
export const STRETCH = Object.freeze({ backgroundAnnulusUnits: [8, 12] as const, topDegree: 0.10, intensityFloorOfPeak: 3e-3,
  innerMaskUnits: 1, taperFromUnits: 4.5 });
/** The shape search. The map is a projection, so the depth comes from asking which simple three-dimensional shape,
 * placed around the star, projects to the radial profile that was measured; it is not the sky image pushed backwards.
 * Two shapes are tried against the azimuthal average, a spherical shell of free radius and thickness and the steady
 * outflow a constant mass-loss rate gives, and the residuals of both are recorded beside the answer. */
export const SHELL_SEARCH = Object.freeze({ profileUnits: [1, 6] as const, bins: 44,
  radiusUnits: [1, 5] as const, widthUnits: [0.2, 3] as const, gridStep: 0.05, outflowExponents: [0.5, 12] as const });

/** The figure's own colour map, sampled at the quarters of its bar: matplotlib `inferno`, which Montargès et al. 2026
 * print the V-band degree of linear polarisation in (Fig. B.1). Four stops are all an RGBA8 grid can carry, and four is
 * enough: the slab compiler sums the channels' emission, so tent weights over these stops interpolate the bar linearly
 * and zero leaves black. The stops are the published map's, not chosen here. */
export const COLOUR_MAP = Object.freeze({
  name: 'inferno',
  stops: Object.freeze([
    Object.freeze([0.258, 0.039, 0.406] as const), // inferno(0.25) #420a68
    Object.freeze([0.578, 0.148, 0.404] as const), // inferno(0.50) #932667
    Object.freeze([0.865, 0.317, 0.226] as const), // inferno(0.75) #dd513a
    Object.freeze([0.988, 0.998, 0.645] as const), // inferno(1.00) #fcffa4
  ]),
  /** The alpha the top of the bar reaches once the renderer's 1-exp(-gain*column) transfer is applied. */
  topAlpha: 0.9,
});
/** The palette the MATISSE reconstruction is already drawn in on the star's own sphere, sampled at the quarters of its
 * bar. This dataset is the same quantity as that sphere, relative intensity at 4 micrometres, so it carries the same
 * scale: the light outside the disc continues the light on it. */
export const HEAT_MAP = Object.freeze({
  name: 'matisse heat scale',
  stops: Object.freeze([
    Object.freeze([0.235, 0.020, 0.000] as const), // 59, 5, 0
    Object.freeze([0.604, 0.118, 0.000] as const), // 154, 30, 0
    Object.freeze([0.878, 0.392, 0.102] as const), // 224, 100, 26
    Object.freeze([1.000, 0.702, 0.251] as const), // 255, 179, 64
  ]),
});
export function heatMapWeights(value: number): readonly [number, number, number, number] {
  const p = Math.max(0, Math.min(1, value)) * HEAT_MAP.stops.length;
  return [0, 1, 2, 3].map(k => Math.max(0, 1 - Math.abs(p - (k + 1)))) as unknown as readonly [number, number, number, number];
}

/** Tent weights over the four stops. Their sum interpolates the bar, and below the first stop it fades to black. */
export function colourMapWeights(value: number): readonly [number, number, number, number] {
  const p = Math.max(0, Math.min(1, value)) * COLOUR_MAP.stops.length;
  return [0, 1, 2, 3].map(k => Math.max(0, 1 - Math.abs(p - (k + 1)))) as unknown as readonly [number, number, number, number];
}
/** Montargès et al. 2021, Extended Data Table 3, December 2019: the optimised epoch. January and March 2020 are recorded
 * there as unoptimised best guesses and are not shipped. Coordinates are theirs, in astronomical units. */
export const VEIL_2019_12 = Object.freeze({ centreRaDecEarthAu: [-1.9, -3.0, 12.5] as const, radiusAu: 6.5,
  densityGramsPerCubicCentimetre: 3.2e-19, grainMicrometres: 0.21, composition: 'MgFeSiO4',
  /** "the southern hemisphere of the star was ten times darker than usual in the visible" (abstract). */
  dimmingFactor: 10,
  /** Display choice, not a measurement: the brightest scattered column is drawn at this fraction of the photosphere's
   * surface brightness, the order an inverse-square dilution gives for a clump 3.7 stellar radii out with a silicate
 * albedo near a half. */
  scatteredSurfaceBrightness: 0.04 });
const METERS_PER_PARSEC = 3.085677581491367e16, ARCSEC_PER_RADIAN = 206264.80624709636, METRES_PER_AU = 1.495978707e11;

function bilinear(values: Float64Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (col: number, row: number) => col < 0 || row < 0 || col >= width || row >= height ? 0 : values[row * width + col]!;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
}
function smoothstep(a: number, b: number, t: number): number { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); }

async function pinnedFits(product: { path: string; sha256: string; bytes: number }) {
  const bytes = await readFile(resolve(root, product.path));
  if (bytes.length !== product.bytes || sha256(bytes) !== product.sha256) throw new Error(`ESO product differs from its pin: ${product.path}`);
  return readFitsImage(bytes);
}

/** Score simple envelopes against a measured radial profile and keep the best. Constant depth is always a candidate,
 * because that is what pushing the image backwards assumes and it is the number every real shape has to beat; the
 * author refuses to write a grid whose best shape is that one. */
function fitEnvelope(profile: readonly { b: number; value: number }[], score: (density: (r: number) => number) => number, innerMaskUnits: number) {
  let shell = { radiusUnits: 0, widthUnits: 0, residual: Infinity };
  for (let radius = SHELL_SEARCH.radiusUnits[0]; radius <= SHELL_SEARCH.radiusUnits[1]; radius += SHELL_SEARCH.gridStep) {
    for (let width of [...Array(Math.round((SHELL_SEARCH.widthUnits[1] - SHELL_SEARCH.widthUnits[0]) / SHELL_SEARCH.gridStep) + 1).keys()]
      .map(step => SHELL_SEARCH.widthUnits[0] + step * SHELL_SEARCH.gridStep)) {
      const residual = score(r => Math.exp(-(((r - radius) / width) ** 2) / 2));
      if (residual < shell.residual) shell = { radiusUnits: radius, widthUnits: width, residual };
    }
  }
  let outflow = { exponent: 0, residual: Infinity };
  for (let n = SHELL_SEARCH.outflowExponents[0]; n <= SHELL_SEARCH.outflowExponents[1]; n += SHELL_SEARCH.gridStep) {
    const residual = score(r => (r < innerMaskUnits ? 0 : Math.pow(r, -n)));
    if (residual < outflow.residual) outflow = { exponent: n, residual };
  }
  const flatResidual = score(() => 1);
  const signalRms = Math.sqrt(profile.reduce((total, point) => total + point.value * point.value, 0) / profile.length);
  const best = shell.residual <= outflow.residual ? 'spherical-shell' : 'steady-outflow';
  const railed = best === 'spherical-shell'
    ? [shell.radiusUnits === SHELL_SEARCH.radiusUnits[0] || shell.radiusUnits === SHELL_SEARCH.radiusUnits[1],
       shell.widthUnits <= SHELL_SEARCH.widthUnits[0] || shell.widthUnits >= SHELL_SEARCH.widthUnits[1]].some(Boolean)
    : outflow.exponent <= SHELL_SEARCH.outflowExponents[0] || outflow.exponent >= SHELL_SEARCH.outflowExponents[1] - SHELL_SEARCH.gridStep;
  if (railed) throw new Error(`The best envelope sits on the edge of the search, so it is not a fit (${best}: shell ${shell.radiusUnits}/${shell.widthUnits}, outflow ${outflow.exponent}).`);
  const bestResidual = Math.min(shell.residual, outflow.residual);
  if (!(bestResidual < flatResidual)) {
    throw new Error(`No envelope beats constant depth for this profile (shell ${shell.residual}, outflow ${outflow.residual}, flat ${flatResidual}).`);
  }
  const density = best === 'spherical-shell'
    ? (r: number) => Math.exp(-(((r - shell.radiusUnits) / shell.widthUnits) ** 2) / 2)
    : (r: number) => (r < innerMaskUnits ? 0 : Math.pow(r, -outflow.exponent));
  return { shell, outflow, flatResidual, signalRms, shape: best, density };
}

/** Encode a field as the RGBA8 grid the slab baker reads; its own channel transfer squares the byte back. */
function encodeGrid(sample: (x: number, y: number, z: number) => number | readonly number[]) {
  const { size, halfUnits } = GRID, step = 2 * halfUnits / size, rgba = new Uint8Array(size ** 3 * 4);
  const byte = (value: number) => Math.round(255 * Math.sqrt(Math.max(0, Math.min(1, value))));
  let peak = 0, filled = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const value = sample(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step, -halfUnits + (k + 0.5) * step);
    // A scalar fills the first three channels. A pair puts extinction in the first channel and the light it scatters in
    // the second, which is how the slab compiler reads absorption and emission separately. Four are four emission
    // channels, one per stop of a colour map.
    const channels = typeof value === 'number' ? [value, value, value, 0] : value;
    if (!channels.some(channel => channel > 0)) continue;
    peak = Math.max(peak, ...channels); filled++;
    const o = 4 * ((k * size + j) * size + i);
    for (const [c, channel] of channels.entries()) rgba[o + c] = byte(channel);
  }
  return { rgba, ktx2: encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: rgba }, 9), peak, filled };
}

/** The slab recipe both grids share: one emission channel, shared opacity, twenty-four slabs an axis. */
function volumeRecipe(grid: string, gridSha256: string, decodedSha256: string, provenanceSha256: string, material: Record<string, unknown>) {
  return {
    schema: 'cssearth-volume-recipe@1',
    grid: { path: grid, sha256: gridSha256, decodedSha256, dimensions: [GRID.size, GRID.size, GRID.size], encoding: 'sqrt-density-unorm8',
      bounds: { min: [-GRID.halfUnits, -GRID.halfUnits, -GRID.halfUnits], max: [GRID.halfUnits, GRID.halfUnits, GRID.halfUnits] } },
    material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', ...material },
    bake: { sliceCounts: { x: GRID.slabs, y: GRID.slabs, z: GRID.slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4,
      cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
    anchors: [{ id: 'betelgeuse', referencePositionM: [0, 0, 0] }],
    provenance: { path: 'provenance.json', sha256: provenanceSha256 },
  };
}

export async function author(defaultLens = 'zimpol-v') {
  const scene = JSON.parse(await readFile(starScene, 'utf8')) as { worldFrame: { originM: [number, number, number]; bodyRadiusM: number; referenceFrame: string; epochJdTt: number } };
  const origin = scene.worldFrame.originM, radiusM = scene.worldFrame.bodyRadiusM, distanceM = Math.hypot(...origin);
  const raDeg = (Math.atan2(origin[1], origin[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(origin[2] / distanceM) * 180 / Math.PI;
  const radiusArcsec = radiusM / distanceM * ARCSEC_PER_RADIAN, pixelsPerUnit = radiusArcsec * 1000 / PIXEL_SCALE_MAS;
  const auPerUnit = radiusM / METRES_PER_AU;
  const { size, halfUnits } = GRID, step = 2 * halfUnits / size;

  // --- the measured lens: the 2024 polarisation map, spread along the line of sight by scattering angle ---
  const intensity = await pinnedFits(PRODUCTS.intensity), dolp = await pinnedFits(PRODUCTS.dolp);
  if (intensity.width !== dolp.width || intensity.height !== dolp.height) throw new Error('Intensity and polarisation grids differ.');
  const { width, height } = intensity, I = intensity.values, P = dolp.values;
  // Star centre: the intensity centroid within fifteen pixels of the peak, iterated. The header reference pixel is the
  // catalogue position, not the star, and sits eighty rows away from it.
  let peakIndex = 0; for (let i = 1; i < I.length; i++) if (I[i]! > I[peakIndex]!) peakIndex = i;
  let cx = peakIndex % width, cy = Math.floor(peakIndex / width);
  for (let pass = 0; pass < 5; pass++) {
    let sx = 0, sy = 0, s = 0;
    for (let y = Math.round(cy) - 15; y <= Math.round(cy) + 15; y++) for (let x = Math.round(cx) - 15; x <= Math.round(cx) + 15; x++) {
      const v = I[y * width + x]!; if (v > 0) { sx += v * x; sy += v * y; s += v; }
    }
    cx = sx / s; cy = sy / s;
  }
  const peakValue = I[peakIndex]!;
  // The two released products share one WCS but are NOT pixel-aligned to each other, so the star's place in the
  // polarisation map has to be measured on the polarisation map. It marks the stellar disc by setting it to exact
  // zero, which nothing else in the frame is; that masked disc is the star. Its centroid is about eleven columns from
  // the intensity centroid, and the published figure's own origin marker agrees with the mask, not with the intensity.
  // Sampling the degree map about the intensity centre put the whole envelope two stellar radii off the star.
  let mx = 0, my = 0, masked = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (P[y * width + x] === 0) { mx += x; my += y; masked++; }
  if (!masked) throw new Error('The polarisation product marks no stellar disc; its centre cannot be measured.');
  const px = mx / masked, py = my / masked, maskedRadiusUnits = Math.sqrt(masked / Math.PI) / pixelsPerUnit;
  if (!(maskedRadiusUnits > 0.5 && maskedRadiusUnits < 1.5)) throw new Error(`The polarisation mask is ${maskedRadiusUnits.toFixed(2)} stellar radii; it is not the stellar disc.`);
  const productOffsetPixels = Math.hypot(px - cx, py - cy);
  const floorSamples: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - px, y - py) / pixelsPerUnit;
    if (r >= STRETCH.backgroundAnnulusUnits[0] && r < STRETCH.backgroundAnnulusUnits[1]) floorSamples.push(P[y * width + x]!);
  }
  floorSamples.sort((a, b) => a - b);
  const background = floorSamples[Math.floor(floorSamples.length / 2)]!;
  // --- the shape: which simple envelope projects to the profile that was measured ---
  const { bins } = SHELL_SEARCH, [profileLow, profileHigh] = SHELL_SEARCH.profileUnits;
  const profileStep = (profileHigh - profileLow) / bins;
  const profileSum = new Float64Array(bins), profileCount = new Float64Array(bins);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const b = Math.hypot(x - px, y - py) / pixelsPerUnit;
    if (b < profileLow || b >= profileHigh) continue;
    const k = Math.min(bins - 1, Math.floor((b - profileLow) / profileStep));
    profileSum[k]! += Math.max(0, P[y * width + x]! - background); profileCount[k]! += 1;
  }
  const measuredProfile = [...profileSum].map((total, k) => ({ b: profileLow + (k + 0.5) * profileStep, value: total / profileCount[k]! }));
  /** Project a radial density through the cube and score it against the measured profile at its best gain. */
  const scoreProfile = (density: (r: number) => number) => {
    const model = measuredProfile.map(({ b }) => {
      let total = 0; const dz = 0.02;
      for (let z = -halfUnits; z <= halfUnits; z += dz) total += density(Math.hypot(b, z)) * dz;
      return total;
    });
    let num = 0, den = 0;
    for (const [i, point] of measuredProfile.entries()) { num += point.value * model[i]!; den += model[i]! * model[i]!; }
    const gain = den > 0 ? num / den : 0;
    let residual = 0;
    for (const [i, point] of measuredProfile.entries()) { const d = point.value - gain * model[i]!; residual += d * d; }
    return Math.sqrt(residual / measuredProfile.length);
  };
  const { shell, outflow, flatResidual, signalRms, density: shellDensity } = fitEnvelope(measuredProfile, scoreProfile, STRETCH.innerMaskUnits);

  // Resolve the sky plane and each column's normalisation once; the encoder then only samples them.
  const plane = new Float64Array(size * size), norm = new Float64Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // This grid's axes: x toward increasing image column (west), y toward increasing image row (north), z away from the observer.
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
    // Each product is read about its own stellar centre, because they are offset from one another.
    const col = px + x * pixelsPerUnit, row = py + y * pixelsPerUnit;
    if (r < STRETCH.innerMaskUnits || bilinear(I, width, height, cx + x * pixelsPerUnit - 0.5, cy + y * pixelsPerUnit - 0.5) < STRETCH.intensityFloorOfPeak * peakValue) continue;
    const degree = bilinear(P, width, height, col - 0.5, row - 0.5) - background;
    plane[j * size + i] = Math.max(0, Math.min(1, degree / (STRETCH.topDegree - background))) * (1 - smoothstep(STRETCH.taperFromUnits, halfUnits, r));
    let sum = 0;
    for (let k = 0; k < size; k++) { const z = -halfUnits + (k + 0.5) * step; sum += shellDensity(Math.hypot(r, z)) * step; }
    norm[j * size + i] = sum;
  }
  // Each voxel carries the four colour-map weights of its sky value, placed along the line of sight on the fitted
  // envelope rather than pushed back from the sky plane. The ray integral of channel k is still the weight itself, so a
  // column reproduces the figure's colour at its own measured degree, and every channel shares one profile, which keeps
  // the composite's chromaticity constant along a column instead of only approximately so. The envelope is symmetric in
  // depth, so each patch is drawn both in front of the star and behind it; nothing here chooses between them.
  const zimpol = encodeGrid((x, y, z) => {
    const i = Math.round((x + halfUnits) / step - 0.5), j = Math.round((y + halfUnits) / step - 0.5);
    const value = plane[j * size + i] ?? 0; if (!(value > 0)) return 0;
    const column = norm[j * size + i]!; if (!(column > 0)) return 0;
    const profile = shellDensity(Math.hypot(x, y, z)) / column;
    return colourMapWeights(value).map(weight => weight * profile);
  });
  // The renderer turns a column into 1-exp(-gain * column) and takes its chromaticity from the same sum, so the gain is
  // fixed by one requirement: the top of the published bar reaches the stated alpha. Its column there is the brightest
  // channel of the last stop.
  const zimpolGain = -Math.log(1 - COLOUR_MAP.topAlpha) / Math.max(...COLOUR_MAP.stops.at(-1)!);

  // --- the third measured lens: the 4 micrometre light outside the photosphere, given the same treatment ---
  // The reconstruction that paints the star's own sphere also carries a fifth of its flux outside the disc. On the
  // sphere that light is a flat plate behind the body; here it is asked for a shape, exactly as the polarisation was.
  const emissionFits = await pinnedFits(EMISSION_2020);
  const { width: ew, height: eh } = emissionFits, E = emissionFits.values;
  const emissionPixelsPerUnit = radiusArcsec * 1000 / EMISSION_2020.pixelMas;
  let esx = 0, esy = 0, es = 0;
  for (let i = 0; i < E.length; i++) { const v = Math.max(0, E[i]!); esx += v * (i % ew); esy += v * Math.floor(i / ew); es += v; }
  const ecx = esx / es, ecy = esy / es;
  // Inside the published disc the sphere is drawn, and within one beam of it the light is the star's own edge smeared
  // by that beam. Neither is resolved structure, so the volume starts one beam outside the disc.
  const emissionInnerUnits = (EMISSION_2020.discDiameterMas / 2 + EMISSION_2020.beamMas) / (radiusArcsec * 1000);
  // The image is only 100 milliarcseconds across, so this dataset speaks for the inner envelope alone and fades at the
  // edge of its own field rather than at the cube wall.
  const emissionFieldUnits = Math.min(halfUnits, (Math.min(ew, eh) / 2) * EMISSION_2020.pixelMas / (radiusArcsec * 1000));
  // The shoulder this dataset exists for sits just inside the field edge, so the taper is short and late.
  const emissionTaperFrom = emissionFieldUnits * 0.94;
  let emissionCentral = 0;
  for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) {
    if (Math.hypot(x - ecx, y - ecy) / emissionPixelsPerUnit < 0.25) emissionCentral = Math.max(emissionCentral, E[y * ew + x]!);
  }
  const emissionTop = emissionCentral * EMISSION_2020.topOfCentral;
  const emissionProfileSum = new Float64Array(bins), emissionProfileCount = new Float64Array(bins);
  for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) {
    const b = Math.hypot(x - ecx, y - ecy) / emissionPixelsPerUnit;
    if (b < emissionInnerUnits || b >= emissionFieldUnits) continue;
    const k = Math.min(bins - 1, Math.floor((b - profileLow) / profileStep));
    if (k < 0) continue;
    emissionProfileSum[k]! += Math.max(0, E[y * ew + x]!); emissionProfileCount[k]! += 1;
  }
  const emissionProfile = [...emissionProfileSum].flatMap((total, k) => profileCount === undefined || !emissionProfileCount[k]
    ? [] : [{ b: profileLow + (k + 0.5) * profileStep, value: total / emissionProfileCount[k]! }]);
  const scoreEmission = (density: (r: number) => number) => {
    const model = emissionProfile.map(({ b }) => {
      let total = 0; const dz = 0.02;
      for (let z = -halfUnits; z <= halfUnits; z += dz) total += density(Math.hypot(b, z)) * dz;
      return total;
    });
    let num = 0, den = 0;
    for (const [i, point] of emissionProfile.entries()) { num += point.value * model[i]!; den += model[i]! * model[i]!; }
    const gain = den > 0 ? num / den : 0;
    let residual = 0;
    for (const [i, point] of emissionProfile.entries()) { const d = point.value - gain * model[i]!; residual += d * d; }
    return Math.sqrt(residual / Math.max(1, emissionProfile.length));
  };
  const emissionFit = fitEnvelope(emissionProfile, scoreEmission, emissionInnerUnits);
  const emissionPlane = new Float64Array(size * size), emissionNorm = new Float64Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
    if (r < emissionInnerUnits || r >= emissionFieldUnits) continue;
    const value = bilinear(E, ew, eh, ecx + x * emissionPixelsPerUnit - 0.5, ecy + y * emissionPixelsPerUnit - 0.5);
    emissionPlane[j * size + i] = Math.max(0, Math.min(1, value / emissionTop)) * (1 - smoothstep(emissionTaperFrom, emissionFieldUnits, r));
    let sum = 0;
    for (let k = 0; k < size; k++) { const z = -halfUnits + (k + 0.5) * step; sum += emissionFit.density(Math.hypot(r, z)) * step; }
    emissionNorm[j * size + i] = sum;
  }
  const emission = encodeGrid((x, y, z) => {
    const i = Math.round((x + halfUnits) / step - 0.5), j = Math.round((y + halfUnits) / step - 0.5);
    const value = emissionPlane[j * size + i] ?? 0; if (!(value > 0)) return 0;
    const column = emissionNorm[j * size + i]!; if (!(column > 0)) return 0;
    const profile = emissionFit.density(Math.hypot(x, y, z)) / column;
    return heatMapWeights(value).map(weight => weight * profile);
  });
  const emissionGain = -Math.log(1 - COLOUR_MAP.topAlpha) / Math.max(...HEAT_MAP.stops.at(-1)!);
  // This dataset's own preview. There is no publisher figure of it: it is this repository's reconstruction, and the
  // part of it drawn here is the part the star's sphere does not show. So the package draws its own, from the same
  // sky plane the grid carries, in the same heat scale, with the removed disc left black.
  const previewSize = 512, previewPixels = Buffer.alloc(previewSize * previewSize * 3);
  for (let y = 0; y < previewSize; y++) for (let x = 0; x < previewSize; x++) {
    const u = (x + 0.5) / previewSize * 2 - 1, v = (y + 0.5) / previewSize * 2 - 1;
    const i = Math.round((u * emissionFieldUnits + halfUnits) / step - 0.5), j = Math.round((v * emissionFieldUnits + halfUnits) / step - 0.5);
    const value = i >= 0 && j >= 0 && i < size && j < size ? emissionPlane[j * size + i] ?? 0 : 0;
    const weights = heatMapWeights(value), out = [0, 0, 0];
    for (const [k, weight] of weights.entries()) for (let c = 0; c < 3; c++) out[c]! += weight * HEAT_MAP.stops[k]![c]!;
    const o = (y * previewSize + x) * 3;
    for (let c = 0; c < 3; c++) previewPixels[o + c] = Math.round(255 * Math.max(0, Math.min(1, out[c]!)));
  }
  const emissionPreview = await sharp(previewPixels, { raw: { width: previewSize, height: previewSize, channels: 3 } })
    .png({ compressionLevel: 9 }).toBuffer();

  // --- the measured lens: the SiO clump, placed in depth by its own line-of-sight velocity ---
  // Every other dataset here is a projection given a shape. This one is a cube: two sky axes measured, and the third
  // from the Doppler shift of each parcel. That is how the Crab's ejecta are placed, and it is the only depth in this
  // package that is not an inference from a projection.
  const sioBytes = await readFile(resolve(root, ALMA_SIO.path));
  if (sioBytes.length !== ALMA_SIO.bytes || sha256(sioBytes) !== ALMA_SIO.sha256) throw new Error('The SiO cube differs from its pin.');
  const sio = readCube(sioBytes);
  const sioMasPerPx = Math.abs(sio.number('CDELT1')) * 3.6e6, sioPxPerStar = radiusArcsec * 1000 / sioMasPerPx;
  const sioCx = sio.number('CRPIX1') - 1, sioCy = sio.number('CRPIX2') - 1;
  const restHz = sio.number('RESTFRQ'), crval3 = sio.number('CRVAL3'), cdelt3 = sio.number('CDELT3');
  const kmsOf = (channel: number) => 299792.458 * (restHz - (crval3 + channel * cdelt3)) / restHz - ALMA_SIO.systemicKmS;
  // The map noise, from the corners of the integrated map where the envelope is not.
  const sioPlane = sio.width * sio.height, moment0 = new Float64Array(sioPlane), moment1 = new Float64Array(sioPlane);
  for (let y = 0; y < sio.height; y++) for (let x = 0; x < sio.width; x++) {
    let sum = 0, weighted = 0;
    for (let c = 0; c < sio.channels; c++) { const value = sio.at(x, y, c); if (!(value > 0)) continue; sum += value; weighted += value * kmsOf(c); }
    moment0[y * sio.width + x] = sum; moment1[y * sio.width + x] = sum > 0 ? weighted / sum : 0;
  }
  let cornerSum = 0, cornerCount = 0;
  for (let y = 0; y < sio.height; y++) for (let x = 0; x < sio.width; x++) {
    if (Math.hypot(x - sioCx, y - sioCy) / sioPxPerStar < 7) continue;
    cornerSum += moment0[y * sio.width + x]! ** 2; cornerCount++;
  }
  const sioNoise = Math.sqrt(cornerSum / Math.max(1, cornerCount)), sioFloor = ALMA_SIO.detectionSigma * sioNoise;
  // What the detection is, measured: where it sits on the sky and how fast it is moving toward or away from us.
  let clumpEast = 0, clumpNorth = 0, clumpVelocity = 0, clumpFlux = 0, detected = 0, brightest = 0;
  for (let y = 0; y < sio.height; y++) for (let x = 0; x < sio.width; x++) {
    const flux = moment0[y * sio.width + x]!; if (!(flux > sioFloor)) continue;
    const r = Math.hypot(x - sioCx, y - sioCy) / sioPxPerStar; if (r < STRETCH.innerMaskUnits || r > halfUnits) continue;
    detected++; brightest = Math.max(brightest, flux);
    clumpEast += flux * -(x - sioCx) / sioPxPerStar; clumpNorth += flux * (y - sioCy) / sioPxPerStar;
    clumpVelocity += flux * moment1[y * sio.width + x]!; clumpFlux += flux;
  }
  if (!detected) throw new Error('The SiO cube carries no detection above its own noise.');
  clumpEast /= clumpFlux; clumpNorth /= clumpFlux; clumpVelocity /= clumpFlux;
  // The flow speed. The clump's motion across the sky is measured against the published 2019 clump; its motion along
  // the line of sight is its own mean Doppler shift. A radial flow at their combination carries both.
  const sioOutflowKmS = Math.hypot(ALMA_SIO.skySpeedKmS, clumpVelocity);
  const sioProjected = Math.hypot(clumpEast, clumpNorth);
  // Each detected parcel: its sky position is measured, and its depth follows from v_los = v_out * z / r.
  const sioGrid = new Float64Array(size * size * size);
  let placed = 0, deepest = 0;
  for (let y = 0; y < sio.height; y++) for (let x = 0; x < sio.width; x++) {
    const flux = moment0[y * sio.width + x]!; if (!(flux > sioFloor)) continue;
    const east = -(x - sioCx) / sioPxPerStar, north = (y - sioCy) / sioPxPerStar;
    const sky = Math.hypot(east, north); if (sky < STRETCH.innerMaskUnits || sky > halfUnits) continue;
    const ratio = Math.max(-ALMA_SIO.maximumProjection, Math.min(ALMA_SIO.maximumProjection, moment1[y * sio.width + x]! / sioOutflowKmS));
    // A redshift is motion away from us, which this grid's z axis points along.
    const radius = sky / Math.sqrt(1 - ratio * ratio), away = radius * ratio;
    if (!Number.isFinite(radius) || radius > halfUnits) continue;
    // This grid's x is west, so an eastward offset is negative x.
    const gx = -east, gy = north, gz = away;
    const i = Math.round((gx + halfUnits) / step - 0.5), j = Math.round((gy + halfUnits) / step - 0.5), k = Math.round((gz + halfUnits) / step - 0.5);
    if (i < 0 || j < 0 || k < 0 || i >= size || j >= size || k >= size) continue;
    // Spread each parcel over the beam it was measured with, so the grid carries no structure finer than the data.
    const spread = Math.max(1, Math.round((sio.number('BMIN') * 3.6e6 / (radiusArcsec * 1000)) / step / 2));
    for (let dk = -spread; dk <= spread; dk++) for (let dj = -spread; dj <= spread; dj++) for (let di = -spread; di <= spread; di++) {
      const a = i + di, b = j + dj, c = k + dk;
      if (a < 0 || b < 0 || c < 0 || a >= size || b >= size || c >= size) continue;
      const d2 = di * di + dj * dj + dk * dk;
      sioGrid[(c * size + b) * size + a]! += flux * Math.exp(-d2 / (2 * spread * spread / 4));
    }
    placed++; deepest = Math.max(deepest, Math.abs(away));
  }
  let sioPeak = 0; for (const value of sioGrid) sioPeak = Math.max(sioPeak, value);
  const sioEmission = encodeGrid((x, y, z) => {
    const i = Math.round((x + halfUnits) / step - 0.5), j = Math.round((y + halfUnits) / step - 0.5), k = Math.round((z + halfUnits) / step - 0.5);
    const value = sioGrid[(k * size + j) * size + i] ?? 0; if (!(value > 0)) return 0;
    return sioMapWeights(value / sioPeak).map(weight => weight * (value / sioPeak));
  });
  const sioGain = -Math.log(1 - COLOUR_MAP.topAlpha) / Math.max(...SIO_MAP.stops.at(-1)!);
  // The integrated line map this dataset is built from, drawn in its own ramp. There is no publisher's figure of it:
  // it is a cutout of an archive product that this package reduced itself.
  const sioPreviewSize = 512, sioPixels = Buffer.alloc(sioPreviewSize * sioPreviewSize * 3);
  for (let y = 0; y < sioPreviewSize; y++) for (let x = 0; x < sioPreviewSize; x++) {
    const u = (x + 0.5) / sioPreviewSize * 2 - 1, v = (y + 0.5) / sioPreviewSize * 2 - 1;
    const i = Math.round(sioCx + u * halfUnits * sioPxPerStar), j = Math.round(sioCy - v * halfUnits * sioPxPerStar);
    const flux = i >= 0 && j >= 0 && i < sio.width && j < sio.height ? moment0[j * sio.width + i]! : 0;
    const weights = sioMapWeights(Math.max(0, Math.min(1, flux / brightest))), out = [0, 0, 0];
    for (const [k, weight] of weights.entries()) for (let c = 0; c < 3; c++) out[c]! += weight * SIO_MAP.stops[k]![c]!;
    const o = (y * sioPreviewSize + x) * 3;
    for (let c = 0; c < 3; c++) sioPixels[o + c] = Math.round(255 * Math.max(0, Math.min(1, out[c]!)));
  }
  const sioPreview = await sharp(sioPixels, { raw: { width: sioPreviewSize, height: sioPreviewSize, channels: 3 } })
    .png({ compressionLevel: 9 }).toBuffer();

  // --- the published lens: the December 2019 RADMC-3D clump, drawn as scattered starlight ---
  // Their axes are x along right ascension (east), y along declination (north), z positive toward Earth. This grid's are
  // west, north and away, so east and toward-Earth both change sign.
  const [xRa, yDec, zEarth] = VEIL_2019_12.centreRaDecEarthAu;
  const centre = [-xRa / auPerUnit, yDec / auPerUnit, -zEarth / auPerUnit] as const;
  const veilRadius = VEIL_2019_12.radiusAu / auPerUnit;
  const nearest = Math.max(1, Math.hypot(...centre) - veilRadius);
  // Montarges et al. 2021 report the southern hemisphere ten times darker than usual, so the line of sight through
  // the clump carries an optical depth of ln 10. The slab compiler integrates density * strength * ds along the ray
  // and the sum of ds across the sphere is its diameter, so this strength puts exactly that depth on the central ray.
  const veilOpticalDepth = Math.log(VEIL_2019_12.dimmingFactor), veilAbsorption = veilOpticalDepth / (2 * veilRadius);
  // The published clump lies wholly between the observer and the photosphere at the Earth view, so the bank may
  // composite it over the star while its centre is the nearer of the two. Fail rather than claim that wrongly.
  if (!(centre[2] + veilRadius < -1)) throw new Error('The clump overlaps the photosphere in depth; it cannot occult it as a whole.');
  const veil = encodeGrid((x, y, z) => {
    if (Math.hypot(x - centre[0], y - centre[1], z - centre[2]) > veilRadius) return [0, 0] as const;
    // The published density is uniform, so the first channel, which the slab compiler reads as extinction, is flat
    // inside the sphere. The second is the light that dust scatters toward us, which follows the inverse-square
    // illumination each parcel receives, normalised to the parcel closest to the photosphere.
    return [1, Math.min(1, nearest ** 2 / Math.max(1, x * x + y * y + z * z))] as const;
  });
  // The scattered light has to be far fainter than the photosphere or it hides the extinction that is the point.
  // Its brightest column is measured here, and the gain below puts that column at the target surface brightness.
  let veilBrightestColumn = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step;
    let column = 0;
    for (let k = 0; k < size; k++) {
      const z = -halfUnits + (k + 0.5) * step;
      if (Math.hypot(x - centre[0], y - centre[1], z - centre[2]) > veilRadius) continue;
      column += Math.min(1, nearest ** 2 / Math.max(1, x * x + y * y + z * z)) * step;
    }
    veilBrightestColumn = Math.max(veilBrightestColumn, column);
  }
  // The slab compiler applies exp(-tau/2) to a slab's own emission, so the gain compensates for the clump's depth.
  const veilGain = -Math.log(1 - VEIL_2019_12.scatteredSurfaceBrightness) / (veilBrightestColumn * Math.exp(-veilOpticalDepth / 2));

  const provenance = {
    schema: 'cssearth-volume-provenance@1',
    title: 'Betelgeuse circumstellar dust: measured polarisation and the published Great Dimming clump',
    kind: 'observed-sky-map-and-published-radiative-transfer-model',
    authors: ['M. Montargès', 'E. Cannon', 'A. de Koter', 'P. Kervella', 'E. Lagadec', 'L. Decin', 'A. Boccaletti', 'O. Flasseur', 'J. Milli', 'S. Ridgway', 'A. K. Dupree'],
    organizations: ['ESO (VLT/SPHERE-ZIMPOL, programmes 0104.D-0300 and 114.28H9.001)', 'High Contrast Data Centre (reduction)'],
    license: { spdx: 'CC-BY-4.0', dataLicenseDeclaration: 'https://archive.eso.org/cms/eso-data-access-policy.html', note: 'ESO Phase 3 release description BETELGEUSE-B DR1, 2026-08-19: science data products from the ESO archive may be distributed under the Creative Commons Attribution 4.0 International license with credit to the ESO provenance. The 2019 clump parameters are published numbers from Montargès et al. 2021, Extended Data Table 3.' },
    sources: [
      { id: 'zimpol-v-intensity', dpId: PRODUCTS.intensity.dpId, url: `https://dataportal.eso.org/dataPortal/file/${PRODUCTS.intensity.dpId}`, sha256: PRODUCTS.intensity.sha256, bytes: PRODUCTS.intensity.bytes, role: 'star centre and intensity floor' },
      { id: 'zimpol-v-dolp', dpId: PRODUCTS.dolp.dpId, url: `https://dataportal.eso.org/dataPortal/file/${PRODUCTS.dolp.dpId}`, sha256: PRODUCTS.dolp.sha256, bytes: PRODUCTS.dolp.bytes, role: 'degree of linear polarisation, the quantity the 2024 leaves carry' },
      { id: 'veil-parameters', url: 'https://doi.org/10.1038/s41586-021-03546-8', preprint: 'https://arxiv.org/abs/2201.10551', role: 'Montargès et al. 2021, Nature 594, 365, Extended Data Table 3 and Figure 6: the December 2019 clump centre, radius, density, composition and grain size, and the coordinate system they are given in' },
    ],
    paper: { doi: '10.1051/0004-6361/202661023', citation: 'Montargès et al. 2026, A&A 711, L12 (the 2024 polarimetry)' },
    measured: { starCentrePixel: [cx, cy], polarisationCentrePixel: [px, py], polarisationMaskRadiusUnits: maskedRadiusUnits,
      sioClump: { detectedBeams: detected, placedParcels: placed, noiseJyBeamKmS: sioNoise,
        skyOffsetUnits: [clumpEast, clumpNorth], projectedUnits: sioProjected,
        positionAngleDegrees: ((Math.atan2(clumpEast, clumpNorth) * 180 / Math.PI) + 360) % 360,
        meanLineOfSightKmS: clumpVelocity, skySpeedKmS: ALMA_SIO.skySpeedKmS, outflowKmS: sioOutflowKmS,
        deepestPlacedUnits: deepest },
      emissionEnvelope: { shape: emissionFit.shape, radiusUnits: emissionFit.shell.radiusUnits, gaussianWidthUnits: emissionFit.shell.widthUnits,
        outflowExponent: emissionFit.outflow.exponent, residualRms: Math.min(emissionFit.shell.residual, emissionFit.outflow.residual),
        constantDepthResidualRms: emissionFit.flatResidual, signalRms: emissionFit.signalRms,
        innerMaskUnits: emissionInnerUnits, fieldUnits: emissionFieldUnits },
      envelope: { shape: 'spherical-shell', radiusUnits: shell.radiusUnits, gaussianWidthUnits: shell.widthUnits,
        residualRms: shell.residual, signalRms, alternatives: { steadyOutflowExponent: outflow.exponent, steadyOutflowResidualRms: outflow.residual, constantDepthResidualRms: flatResidual } },
      productOffsetPixels, intensityPeak: peakValue, polarisationFloor: background, pixelsPerStellarRadius: pixelsPerUnit,
      colourMap: COLOUR_MAP.name, colourScaleTopDegree: STRETCH.topDegree, zimpolExposureGain: zimpolGain,
      stellarRadiusArcsec: radiusArcsec, stellarRadiusAu: auPerUnit, sceneOriginRaDecDeg: [raDeg, decDeg], distancePc: distanceM / METERS_PER_PARSEC,
      veilCentreUnits: [...centre], veilRadiusUnits: veilRadius },
    models: {
      'zimpol-v': `Fitted envelope, drawn in the published figure's own colour map. The degree map is floor-subtracted and carried on the same scale as that figure's colourbar, zero to ${STRETCH.topDegree.toFixed(2)}. Depth is not the sky image pushed backwards: the azimuthally averaged radial profile is fitted with simple three-dimensional envelopes placed around the star, and the one that projects to it is a spherical shell of radius ${shell.radiusUnits.toFixed(2)} stellar radii and gaussian thickness ${shell.widthUnits.toFixed(2)}, which leaves a residual of ${shell.residual.toExponential(2)} against a profile of ${signalRms.toExponential(2)}. A steady outflow r^-${outflow.exponent.toFixed(2)} leaves ${outflow.residual.toExponential(2)} and a constant depth, which is what pushing the image backwards assumes, leaves ${flatResidual.toExponential(2)}. Each sky column is spread along that envelope and normalised so it reproduces its measured degree, which puts a patch at the shell's own radius rather than smeared through the box. The envelope is symmetric in depth, so every patch is drawn both in front of the star and behind it. Colour is matplotlib ${COLOUR_MAP.name} sampled at the quarters of the bar and carried as four emission channels, one per stop, so the compiler's sum interpolates the bar and the column emits the bar colour of its own degree; every channel shares the one depth profile, so a column's chromaticity does not vary along it. The disc within one radius and everything fainter than three thousandths of the stellar peak are removed; the map tapers out between 4.5 and 6 radii. Depth is not measured.`,
      'sio-2023': `Measured depth, not inferred. The archive's pipeline cube of SiO v=0 J=5-4 was cut out around the star, its continuum removed against 1738 line-free channels and the line integrated. ${detected} beams clear ${ALMA_SIO.detectionSigma} times the map noise, and they form one clump ${sioProjected.toFixed(2)} stellar radii out at position angle ${(((Math.atan2(clumpEast, clumpNorth) * 180 / Math.PI) + 360) % 360).toFixed(0)} degrees, not a shell. Each parcel's depth is its own Doppler shift under a radial flow of ${sioOutflowKmS.toFixed(1)} km/s, which combines ${ALMA_SIO.skySpeedKmS} km/s across the sky, measured against the published December 2019 clump over the 3.63 years between the epochs, with the clump's own mean line-of-sight velocity of ${clumpVelocity.toFixed(1)} km/s. A parcel is spread over the beam it was measured with, and a line of sight is never deprojected past ${ALMA_SIO.maximumProjection} of the flow speed. ${placed} parcels are placed, the furthest ${deepest.toFixed(2)} stellar radii along the line of sight. The flow speed is the one stated assumption; the two sky axes and the velocity are measured.`,
      'emission-2020': `The 4 micrometre light outside the photosphere, from the same reconstruction that paints the star's own sphere. Its disc and the first beam beyond it are removed: inside the disc the sphere is drawn, and within one beam of it the light is the star's edge smeared by that beam. What is left carries a fifth of the reconstruction's flux and falls too slowly to be that beam. The depth is fitted the same way as the polarisation: the best envelope is a ${emissionFit.shape} (${emissionFit.shape === 'spherical-shell' ? `radius ${emissionFit.shell.radiusUnits.toFixed(2)} stellar radii, gaussian thickness ${emissionFit.shell.widthUnits.toFixed(2)}` : `r^-${emissionFit.outflow.exponent.toFixed(2)}`}) leaving ${Math.min(emissionFit.shell.residual, emissionFit.outflow.residual).toExponential(2)}, against ${emissionFit.flatResidual.toExponential(2)} for the constant depth an extrusion assumes and a profile of ${emissionFit.signalRms.toExponential(2)}. The image is only 100 milliarcseconds across, so this dataset speaks for the inner envelope alone and fades at the edge of its own field. Colour is the reconstruction's own heat scale, the same one the sphere carries, because this is the same quantity.`,
      'veil-2019-12': `The published December 2019 clump: a sphere of radius ${VEIL_2019_12.radiusAu} au centred at (${VEIL_2019_12.centreRaDecEarthAu.join(', ')}) au along right ascension, declination and toward Earth, of constant dust density ${VEIL_2019_12.densityGramsPerCubicCentimetre} g/cm3 in ${VEIL_2019_12.composition} grains centred on ${VEIL_2019_12.grainMicrometres} micrometres. The uniform density is drawn as grey extinction, scaled so the line of sight through the clump's centre carries an optical depth of ln ${VEIL_2019_12.dimmingFactor}, which is the ${VEIL_2019_12.dimmingFactor}-times dimming of the southern hemisphere the paper reports. Ordinary source-over compositing then gives transmission times the star behind plus the light the dust scatters toward us, so the photosphere is dimmed rather than covered. The scattered term follows the inverse-square illumination each parcel receives and its brightest column is drawn at ${VEIL_2019_12.scatteredSurfaceBrightness} of the photosphere's surface brightness, which is a display choice.`,
    },
    limitations: [
      'The 2024 map is one epoch, one filter and one sky-plane image: no third axis was observed. Its depth is the envelope that best projects to the measured radial profile, which is an inference from that profile, not a measurement, and it cannot say which patches are in front and which behind.',
      'The degree of polarisation is a ratio; its instrumental floor was measured beyond eight radii and subtracted.',
      'The two released V-band products share one WCS but are not pixel-aligned to each other; each is read about its own stellar centre, the intensity centroid and the masked disc of the degree map respectively.',
      `The 2024 colours are the publisher's ${COLOUR_MAP.name} colour map for that ratio, on the same zero-to-${STRETCH.topDegree.toFixed(2)} scale as their figure. They are a legend, not the colour of the dust and not a temperature.`,
      `Brightness follows the renderer's 1-exp(-gain*column) transfer rather than the flat bar of a printed figure, so mid-scale values sit brighter than a linear colourbar would put them; the hue at every value is the published one.`,
      'Four colour stops are the most an RGBA8 grid can carry, so the bar is interpolated between quarters rather than sampled continuously.',
      'Structure finer than the 16 mas beam, three quarters of a stellar radius, is not in the 2024 data.',
      'The 2019 clump is a model fitted to images, not an image. Its January and March 2020 epochs are recorded by its own authors as unoptimised best guesses and are not shipped.',
      'Silicates sublimate near 1500 K, so the real clump is emptier on the side facing the star than a uniform sphere; its authors record that this does not change their result, and the uniform sphere they published is what is drawn.',
      'Scattered starlight is drawn warm because it is the star’s own light; no colour was measured.',
      'The two lenses are five years apart. Neither is a picture of the other.',
      'The clump dims the star by ordinary alpha compositing, which is exact for extinction but cannot be cut by the photosphere: it covers the whole silhouette it crosses rather than being clipped at the limb.',
      'Its extinction is grey. Silicate dust reddens what it transmits; no colour was applied because the photosphere behind it is drawn in an infrared intensity palette, not in colour.',
      'The scattered light is a stated display level, not a measurement.',
      'The 2024 map always composites behind the star, because its emission surrounds the body instead of standing clear of it in depth.',
    ],
  };
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n');
  const provenanceSha = sha256(provenanceBytes);
  const grids = [
    { id: 'zimpol-v', label: 'SPHERE/ZIMPOL · polarised dust, 2024', file: 'density-zimpol-v.ktx2', built: zimpol,
      sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B',
      // Four emission channels, one per stop of the figure's colour map. The compiler sums them, so a column emits the
      // interpolated bar colour at its own degree; shared opacity keeps that chromaticity exactly and turns the summed
      // column into the alpha. This is the published false-colour map rendered in depth, not a colour of the dust.
      material: { emission: COLOUR_MAP.stops.map((color, channel) => ({ channel, color: [...color], strength: 1 })),
        absorption: [], emissionTransfer: 'shared-opacity', exposureGain: zimpolGain } },
    { id: 'veil-2019-12', label: 'Great Dimming clump · December 2019', file: 'density-veil-2019-12.ktx2', built: veil,
      sourceUrl: 'https://arxiv.org/abs/2201.10551', occultingCentreUnits: [...centre] as [number, number, number],
      // Grey extinction from the uniform published density, and the warm light it scatters from the second channel.
      // Ordinary source-over then gives transmission times what is behind plus the scattered term, which is the
      // emission-absorption composite: the star behind the clump is dimmed, not covered.
      material: { emission: [{ channel: 1, color: [1, 0.82, 0.62], strength: 1 }],
        absorption: [{ channel: 0, color: [1, 1, 1], strength: veilAbsorption }], exposureGain: veilGain } },
    { id: 'emission-2020', label: 'VLTI/MATISSE · off-limb light, 2020', file: 'density-emission-2020.ktx2', built: emission,
      sourceUrl: 'https://doi.org/10.1051/0004-6361/202347719',
      // The same quantity as the star's own sphere, so the same palette: four channels over the reconstruction's heat
      // scale, shared opacity, and the light outside the disc continues the light on it.
      material: { emission: HEAT_MAP.stops.map((color, channel) => ({ channel, color: [...color], strength: 1 })),
        absorption: [], emissionTransfer: 'shared-opacity', exposureGain: emissionGain } },
    { id: 'sio-2023', label: 'ALMA \u00b7 SiO clump, August 2023', file: 'density-sio-2023.ktx2', built: sioEmission,
      sourceUrl: 'https://almascience.org/aq/?result_view=observation&projectCode=2022.A.00026.S',
      // The one grid here whose third axis is measured. Four channels over a perceptual ramp, shared opacity.
      material: { emission: SIO_MAP.stops.map((color, channel) => ({ channel, color: [...color], strength: 1 })),
        absorption: [], emissionTransfer: 'shared-opacity', exposureGain: sioGain } },
  ];
  const outputs: [string, Buffer][] = [['provenance.json', provenanceBytes], [EMISSION_PREVIEW_PATH, emissionPreview], [SIO_PREVIEW_PATH, sioPreview]];
  const deliveryGrids: { id: string; label: string; sourceUrl: string; recipe: { path: string; sha256: string }; occultingCentreUnits?: [number, number, number] }[] = [];
  for (const grid of grids) {
    const recipeBytes = Buffer.from(JSON.stringify(volumeRecipe(grid.file, sha256(grid.built.ktx2), sha256(grid.built.rgba), provenanceSha, grid.material), null, 2) + '\n');
    outputs.push([grid.file, Buffer.from(grid.built.ktx2)], [`volume-${grid.id}.json`, recipeBytes]);
    deliveryGrids.push({ id: grid.id, label: grid.label, sourceUrl: grid.sourceUrl,
      recipe: { path: `src/objects/betelgeuse-shell/source/volume-${grid.id}.json`, sha256: sha256(recipeBytes) },
      ...('occultingCentreUnits' in grid ? { occultingCentreUnits: grid.occultingCentreUnits } : {}) });
  }
  const delivery = {
    schema: 'cssearth-nebula-delivery@1', id: 'betelgeuse-shell', method: 'density-grid',
    request: deliveryGrids.find(grid => grid.id === defaultLens)!.recipe,
    inputPins: [{ path: 'src/objects/betelgeuse-shell/source/provenance.json', sha256: provenanceSha },
      ...grids.map(grid => ({ path: `src/objects/betelgeuse-shell/source/${grid.file}`, sha256: sha256(grid.built.ktx2) }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc: distanceM / METERS_PER_PARSEC, imageRotationDegrees: 0, arcsecPerUnit: radiusArcsec },
    sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B',
    description: 'Dust around Betelgeuse in two datasets that share one frame: the degree of linear polarisation measured by VLT/SPHERE-ZIMPOL on 3 December 2024, and the dust clump Montargès et al. fitted to the Great Dimming of December 2019. One unit is one stellar radius; the depth of each is a stated model, not a measurement.',
    defaultLens, framingRadiusUnits: GRID.halfUnits,
    // This cloud belongs to Betelgeuse. It is not a place of its own, so it has no catalogue entry and never appears
    // as a marker, a search result or a destination; its datasets are listed by the star.
    attachedTo: 'betelgeuse',
    acceptedLabResult: 'betelgeuse-shell-four-grids',
    compactInputs: deliveryGrids.find(grid => grid.id === defaultLens)!.recipe, compactMethod: 'density-grid',
    grids: deliveryGrids,
  };
  const sceneBytes = await readFile(starScene);
  void sceneBytes;
  outputs.push(['delivery.json', Buffer.from(JSON.stringify(delivery, null, 2) + '\n')]);

  // The presentation the application reads, and the manifest that accounts for every retained source byte.
  const facts = (grid: typeof grids[number]) => grid.id === 'sio-2023'
    ? [{ id: 'instrument', label: 'Instrument', value: `ALMA band 6, SiO v=0 J=5\u20134 at 217.105 GHz, 2 August 2023, beam ${(sio.number('BMAJ') * 3.6e6).toFixed(0)} \u00d7 ${(sio.number('BMIN') * 3.6e6).toFixed(0)} mas` },
       { id: 'detection', label: 'Detection', value: `${detected} beams above ${ALMA_SIO.detectionSigma} sigma in the integrated line` },
       { id: 'clump', label: 'Where it is', value: `${sioProjected.toFixed(2)} stellar radii from the star on the sky, position angle ${(((Math.atan2(clumpEast, clumpNorth) * 180 / Math.PI) + 360) % 360).toFixed(0)} degrees` },
       { id: 'flow', label: 'Flow speed', value: `${sioOutflowKmS.toFixed(1)} km/s: ${ALMA_SIO.skySpeedKmS} across the sky, measured against the 2019 clump, and ${clumpVelocity.toFixed(1)} along the line of sight` },
       { id: 'depth', label: 'Depth', value: 'Measured: the Doppler shift of each parcel, under a radial flow at that speed' }]
    : grid.id === 'emission-2020'
    ? [{ id: 'instrument', label: 'Instrument', value: 'VLTI/MATISSE, 3.94\u20134.00 \u00b5m, February 2020, 4 mas beam' },
       { id: 'extent', label: 'Drawn extent', value: `${emissionInnerUnits.toFixed(2)} to ${emissionFieldUnits.toFixed(2)} stellar radii: outside the disc and its first beam, to the edge of the 100 mas field` },
       { id: 'share', label: 'Share of the flux', value: 'A fifth of the reconstruction lies outside the disc' },
       { id: 'scale', label: 'Colour scale', value: "The reconstruction's own heat scale, the one the star's sphere carries" },
       { id: 'depth', label: 'Depth', value: `Not measured; the steeply falling envelope r^\u2212${emissionFit.outflow.exponent.toFixed(1)} that best projects to the measured profile` }]
    : grid.id === 'zimpol-v'
    ? [{ id: 'instrument', label: 'Instrument', value: 'VLT/SPHERE-ZIMPOL, V band, 3 December 2024' },
       { id: 'resolution', label: 'Angular resolution', value: '16 mas, 0.76 stellar radii' },
       { id: 'extent', label: 'Drawn extent', value: '1 to 4.5 stellar radii, tapering to 6' },
       { id: 'scale', label: 'Colour scale', value: `Degree of linear polarisation 0 to ${STRETCH.topDegree.toFixed(2)}, the paper's ${COLOUR_MAP.name} map` },
       { id: 'depth', label: 'Depth', value: `Not measured; the spherical shell at ${shell.radiusUnits.toFixed(1)} stellar radii that best projects to the measured profile` }]
    : [{ id: 'model', label: 'Model', value: 'RADMC-3D sphere of constant density, Montarg\u00e8s et al. 2021, Extended Data Table 3' },
       { id: 'geometry', label: 'Centre and radius', value: '(\u22121.9, \u22123.0, +12.5) au along right ascension, declination and toward Earth; radius 6.5 au' },
       { id: 'density', label: 'Dust density', value: '3.2 \u00d7 10\u207b\u00b9\u2079 g cm\u207b\u00b3 in MgFeSiO\u2084 grains centred on 0.21 \u00b5m' },
       { id: 'extinction', label: 'Optical depth', value: `ln ${VEIL_2019_12.dimmingFactor} through the centre, the ${VEIL_2019_12.dimmingFactor}-times dimming the paper reports` },
       { id: 'epoch', label: 'Epoch', value: 'December 2019, the only optimised solution the paper reports' }];
  const presentation = {
    schema: 'cssearth-volume-presentation-source@1', objectId: 'betelgeuse-shell', name: 'Betelgeuse dust shell',
    defaultLens,
    bank: { path: 'src/objects/betelgeuse-shell/prepared/lenses.json', sha256: '', bytes: 0 },
    recipes: deliveryGrids.map(grid => ({ id: grid.id, path: grid.recipe.path, sha256: grid.recipe.sha256, bytes: 0 })),
    sharedInputs: [],
    inputEvidence: [],
    lenses: grids.map(grid => ({
      id: grid.id, label: grid.label,
      title: grid.id === 'sio-2023' ? 'A clump of silicon monoxide, placed by its own velocity'
        : grid.id === 'emission-2020' ? 'The light outside Betelgeuse\u2019s disc at 4 micrometres'
        : grid.id === 'zimpol-v' ? 'Polarised dust around Betelgeuse in 2024' : 'The dust clump of the Great Dimming',
      description: grid.id === 'sio-2023'
        ? `ALMA saw silicon monoxide around this star on 2 August 2023, and this is the one dataset here whose depth is measured rather than inferred. The archive's own pipeline cube was cut out around the star, its continuum removed against 1738 line-free channels, and the line integrated: ${detected} beams clear ${ALMA_SIO.detectionSigma} times the map noise. What they show is not a shell but a single clump ${sioProjected.toFixed(2)} stellar radii out at position angle ${(((Math.atan2(clumpEast, clumpNorth) * 180 / Math.PI) + 360) % 360).toFixed(0)} degrees, the same quarter of the sky as the clump that dimmed the star in 2019, and about as far out as that one would have drifted at an ordinary ejecta speed. Each parcel is then placed in depth by its own Doppler shift, under a radial flow at ${sioOutflowKmS.toFixed(1)} kilometres a second. Silicon monoxide is what silicate dust condenses from, so this is the material of the other two datasets caught before it became dust. The colours are a false-colour ramp for line brightness.`
        : grid.id === 'emission-2020'
        ? `The same reconstruction that paints this star\u2019s sphere carries a fifth of its flux outside the published disc. On the sphere that light is a flat plate behind the body; here it is given a shape. The disc and the first beam beyond it are removed, because inside the disc the sphere is drawn and within one beam of it the light is the star\u2019s own edge smeared by the beam. What is left falls far too slowly to be that beam: the envelope that best projects to it is r^\u2212${emissionFit.outflow.exponent.toFixed(1)}, five times better than the constant depth an extrusion assumes. The image spans 100 milliarcseconds, so this speaks for the inner envelope alone. Its colours are the reconstruction\u2019s own heat scale, because this is the same quantity as the sphere.`
        : grid.id === 'zimpol-v'
        ? `The degree of linear polarisation VLT/SPHERE-ZIMPOL measured in the V band on 3 December 2024, in the colour map and on the zero-to-${STRETCH.topDegree.toFixed(2)} scale the paper prints it in, placed in the plane of the sky through the star and spread along the line of sight by the scattering-angle efficiency of polarised light. The patches are dust. The colours are the publisher's legend for a ratio, not the colour of anything. Depth is a stated convention, not a measurement, and nothing finer than the 16 milliarcsecond beam is in the data.`
        : 'The dust clump Montarg\u00e8s et al. fitted with RADMC-3D to the images of the Great Dimming, drawn from the numbers they published for December 2019: a sphere of uniform density south and slightly west of the star and between it and us. Its extinction is scaled so the line of sight through its centre dims the star ten times, as the paper reports for the southern hemisphere, and the light it scatters back is drawn faintly over that. This is a model fitted to images, not an image.',
      summary: grid.id === 'sio-2023' ? 'Silicon monoxide around the star, the only dataset here whose depth is measured rather than inferred.'
        : grid.id === 'emission-2020' ? 'The fifth of the reconstruction that lies outside the disc, given the shape that best projects to it.'
        : grid.id === 'zimpol-v' ? 'Measured polarised light from dust one to 4.5 stellar radii out; its depth is a convention.' : 'The published model of the dust that dimmed the star ten times in December 2019, drawn as the extinction it causes.',
      detail: grid.id === 'sio-2023' ? `${sio.width} \u00d7 ${sio.height} px at ${sioMasPerPx.toFixed(2)} mas, ${sio.channels} channels`
        : grid.id === 'emission-2020' ? '128 \u00d7 128 px at 0.78 mas'
        : grid.id === 'zimpol-v' ? '1024 \u00d7 1024 px at 3.6 mas' : 'Sphere of 6.5 au at 13.0 au',
      facts: facts(grid), input: grid.id === 'sio-2023' ? 'alma-sio-v0-5-4-2023-08'
        : grid.id === 'emission-2020' ? 'matisse-2020-02-continuum-4mas'
        : grid.id === 'zimpol-v' ? 'sphere-zimpol-betelgeuse-p1-v-dolp' : 'veil-2019-12-parameters',
      preview: grid.id === 'sio-2023'
        ? { path: `${packageBase}/${SIO_PREVIEW_PATH}`, sha256: sha256(sioPreview), bytes: sioPreview.length,
            authoredFrom: 'alma-sio-v0-5-4-2023-08' }
        : grid.id === 'emission-2020'
        ? { path: `${packageBase}/${EMISSION_PREVIEW_PATH}`, sha256: sha256(emissionPreview), bytes: emissionPreview.length,
            authoredFrom: 'matisse-2020-02-continuum-4mas' }
        : { path: `${packageBase}/${PREVIEWS[grid.id as keyof typeof PREVIEWS].path}`,
            sha256: PREVIEWS[grid.id as keyof typeof PREVIEWS].sha256, bytes: PREVIEWS[grid.id as keyof typeof PREVIEWS].bytes,
            url: PREVIEWS[grid.id as keyof typeof PREVIEWS].url,
            ...('crop' in PREVIEWS[grid.id as keyof typeof PREVIEWS] ? { crop: (PREVIEWS[grid.id as keyof typeof PREVIEWS] as { crop: unknown }).crop } : {}) },
    })),
  };
  outputs.push(['veil-2019-12-parameters.json', Buffer.from(JSON.stringify({
    schema: 'cssearth-published-model-parameters@1', objectId: 'betelgeuse-shell', lensId: 'veil-2019-12',
    citation: 'Montarg\u00e8s, M., Cannon, E., Lagadec, E., de Koter, A., Kervella, P., Sanchez-Bermudez, J., Paladini, C., Cannon, E., et al. 2021, "A dusty veil shading Betelgeuse during its Great Dimming", Nature 594, 365',
    doi: '10.1038/s41586-021-03546-8', preprint: 'https://arxiv.org/abs/2201.10551',
    locator: 'Extended Data Table 3, column "December 2019"; axes defined by Extended Data Figure 6',
    coordinates: 'x along right ascension, y along declination, z positive toward Earth, origin at the centre of the star',
    epoch: '2019-12', centreAu: [...VEIL_2019_12.centreRaDecEarthAu], radiusAu: VEIL_2019_12.radiusAu,
    dustDensityGramsPerCubicCentimetre: VEIL_2019_12.densityGramsPerCubicCentimetre,
    composition: VEIL_2019_12.composition, grainMicrometres: VEIL_2019_12.grainMicrometres,
    notes: 'The same table gives January and March 2020 solutions, which the paper records as unoptimised best guesses; they are not used. Silicates sublimate near 1500 K, so the real clump is emptier on the side facing the star than the uniform sphere the paper published and this record repeats.',
  }, null, 2) + '\n')]);
  outputs.push(['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')]);

  // The bank pin closes over the baked output, so it is filled on the pass after a bake; the first pass leaves it empty
  // and preparation refuses it, which is the intended order: author, bake, author again.
  const bankPath = resolve(root, '..', 'prepared/lenses.json');
  const bankBytes = await readFile(bankPath).catch(() => null);
  if (bankBytes) { presentation.bank = { path: 'src/objects/betelgeuse-shell/prepared/lenses.json', sha256: sha256(bankBytes), bytes: bankBytes.length }; }
  for (const recipe of presentation.recipes) {
    const bytes = outputs.find(([name]) => `${packageBase}/${name}` === recipe.path)?.[1];
    if (bytes) recipe.bytes = bytes.length;
  }
  outputs[outputs.findIndex(([name]) => name === 'presentation.json')] = ['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')];

  // Every retained byte under source/, accounted for once. Files this script writes are hashed from what it just
  // produced; the archive products and publisher figures beside them are hashed from disk.
  const produced = new Map(outputs.map(([name, bytes]) => [name, bytes]));
  const walked: string[] = [];
  const walk = async (relativePath: string) => {
    for (const entry of (await readdir(resolve(root, relativePath || '.'), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const next = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next); else if (next !== 'manifest.json') walked.push(next);
    }
  };
  await walk('');
  for (const name of produced.keys()) if (!walked.includes(name)) walked.push(name);
  const observations: Record<string, { dpId: string; role: string }> = {
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits': { dpId: PRODUCTS.intensity.dpId, role: 'V-band pipeline intensity; the star centre and the intensity floor are measured on it' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits': { dpId: PRODUCTS.dolp.dpId, role: 'V-band degree of linear polarisation; the quantity the 2024 lens carries' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_N_I_phase3.fits': { dpId: 'ADP.2026-08-19T13:19:07.647', role: 'N_I pipeline intensity, retained for comparison and not drawn' },
    'observations/SPHERE_ZIMPOL_Betelgeuse_P1_N_I_DOLP.fits': { dpId: 'ADP.2026-08-19T13:19:07.648', role: 'N_I degree of linear polarisation, retained for comparison and not drawn' },
  };
  const previewByPath = new Map(Object.entries(PREVIEWS).map(([id, preview]) => [preview.path, { id, ...preview }]));
  const inputs: unknown[] = [], documents: unknown[] = [], intermediates: unknown[] = [];
  // The catalogue records are generated by tools/author-source-records.mts from these bindings. Their evidence names
  // the commit the manifest was pinned at, which that tool writes with --evidence; a binding already pinned keeps its
  // revision so re-authoring never unpins a record.
  type PinnedManifest = { inputs?: { id?: string; sourceBinding?: { references?: { catalogueId?: string; evidence?: string }[] } }[] };
  const pinnedManifest: PinnedManifest = await readFile(resolve(root, 'manifest.json'), 'utf8').then(
    text => JSON.parse(text) as PinnedManifest, (): PinnedManifest => ({}));
  const pinnedEvidence = new Map((pinnedManifest.inputs ?? []).flatMap(input =>
    (input.sourceBinding?.references ?? []).map(reference => [`${input.id}/${reference.catalogueId}`, reference.evidence])));
  const binding = (id: string) => {
    const catalogueId = `source-betelgeuse-shell-${id}`;
    const evidence = pinnedEvidence.get(`${id}/${catalogueId}`) ?? `${packageBase}/manifest.json@${'0'.repeat(40)}#/inputs/${inputs.length}`;
    return { dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] } };
  };
  for (const name of walked.sort((a, b) => a.localeCompare(b, 'en'))) {
    const bytes = produced.get(name) ?? await readFile(resolve(root, name));
    const path = `${packageBase}/${name}`, pin = { expectedSha256: sha256(bytes), expectedBytes: bytes.length };
    const observation = observations[name], preview = previewByPath.get(name);
    if (observation) {
      const id = name.split('/').at(-1)!.replace(/\.fits$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      inputs.push({ id, ...binding(id), path,
        origin: `https://dataportal.eso.org/dataPortal/file/${observation.dpId}`, sourceUrl: 'https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B',
        title: `ESO Phase 3 BETELGEUSE-B \u00b7 ${observation.dpId}`, credit: 'ESO/VLT/SPHERE-ZIMPOL, programme 114.28H9.001; Montarg\u00e8s et al. 2026, A&A 711, L12',
        displayCredit: 'ESO/VLT/SPHERE-ZIMPOL', acquisition: `Downloaded unchanged from the ESO archive by its DataLink identifier ${observation.dpId}. ${observation.role}.`,
        license: 'CC-BY-4.0 under the ESO data access policy; retain the ESO provenance and the paper citation.',
        ...(id === 'sphere-zimpol-betelgeuse-p1-v-dolp' ? { lensId: 'zimpol-v' } : {}), ...pin });
    } else if (preview) {
      inputs.push({ id: `preview-${preview.id}`, ...binding(`preview-${preview.id}`), path, origin: preview.origin, sourceUrl: preview.origin, title: preview.title,
        credit: preview.credit, displayCredit: preview.credit,
        acquisition: `Publisher figure downloaded unchanged from ${preview.url}; preparation resizes it into this object's dataset preview.`,
        license: preview.license, ...pin });
    } else if (name === ALMA_SIO.path) {
      inputs.push({ id: 'alma-sio-v0-5-4-2023-08', ...binding('alma-sio-v0-5-4-2023-08'), path,
        origin: `https://almascience.eso.org/soda/sync?ID=${ALMA_SIO.product}`,
        sourceUrl: 'https://almascience.org/aq/?result_view=observation&projectCode=2022.A.00026.S',
        title: `ALMA ${ALMA_SIO.proposal} \u00b7 SiO v=0 J=5-4 cube of Betelgeuse, 2 August 2023`,
        credit: 'ALMA (ESO/NAOJ/NRAO), project 2022.A.00026.S, member ' + ALMA_SIO.member,
        displayCredit: 'ALMA (ESO/NAOJ/NRAO)',
        acquisition: `Cut out of the archive's own pipeline cube ${ALMA_SIO.product} through its SODA service, on a circle of 0.00025 degrees about the observation's phase centre, then continuum-subtracted against the 1738 line-free channels of the spectral window and windowed to 32 kilometres a second either side of the star's velocity. The archive product is 72 GB; this is the part of it that carries the line around this star.`,
        license: 'ALMA data are public under the ALMA data access policy; retain the ALMA credit line.',
        lensId: 'sio-2023', ...pin });
    } else if (name === EMISSION_2020.path) {
      inputs.push({ id: 'matisse-2020-02-continuum-4mas', ...binding('matisse-2020-02-continuum-4mas'), path,
        origin: 'https://github.com/fabienbaron/squeeze/tree/4d34e877606f16be73e7689fcb517d0b72d9d455',
        sourceUrl: 'https://doi.org/10.1051/0004-6361/202347719',
        title: 'VLTI/MATISSE 4 \u00b5m reconstruction, February 2020, convolved to the 4 mas beam',
        credit: 'Reconstruction by this repository with SQUEEZE 3.0 (F. Baron, GPL-3.0) from ESO/VLTI/MATISSE calibrated visibilities via the JMMC OiDB; observations from Drevon et al. (2024)',
        displayCredit: 'ESO/VLTI/MATISSE; reconstruction by this repository',
        acquisition: 'The same bytes Betelgeuse\u2019s own package ships and pins, copied here so this package accounts for every byte it reads. Only the light outside the published disc is used; the disc itself is the star\u2019s drawn sphere.',
        license: 'Reconstruction released by this repository under its own licence; the MATISSE visibilities are ESO archive data under the ESO data access policy.',
        lensId: 'emission-2020', ...pin });
    } else if (name === 'veil-2019-12-parameters.json') {
      inputs.push({ id: 'veil-2019-12-parameters', ...binding('veil-2019-12-parameters'), path,
        origin: 'https://doi.org/10.1038/s41586-021-03546-8', sourceUrl: 'https://arxiv.org/abs/2201.10551',
        title: 'Montarg\u00e8s et al. 2021 \u00b7 December 2019 dust clump parameters',
        credit: 'Montarg\u00e8s et al. 2021, Nature 594, 365, Extended Data Table 3 and Figure 6',
        displayCredit: 'Montarg\u00e8s et al. (2021)',
        acquisition: 'The published December 2019 clump geometry, density, composition and grain size, transcribed from the paper with its coordinate convention. This record identifies the transcription; the paper is the source.',
        license: 'Published numbers cited under normal scholarly citation; the paper is not redistributed here.',
        lensId: 'veil-2019-12', ...pin });
    } else if (name.endsWith('.pdf')) {
      documents.push({ id: 'release-description', path, ...pin,
        sourceBinding: { kind: 'local', reason: 'The ESO Phase 3 release description of the collection, retained beside the products it describes.' } });
    } else if (name.endsWith('.ktx2') || name.startsWith('volume-')) {
      intermediates.push({ id: name.replace(/[^a-z0-9-]+/g, '-').toLowerCase(), path, ...pin,
        sourceBinding: { kind: 'local', reason: 'Density grid and slab recipe written by tools/objects/source-authoring/betelgeuse-shell/author.mts from the archive products and published parameters bound above.' } });
    } else {
      documents.push({ id: name.replace(/[^a-z0-9-]+/g, '-').toLowerCase(), path, ...pin,
        sourceBinding: { kind: 'local', reason: 'Object-owned delivery, catalogue, provenance or presentation record; the published inputs it cites are bound above.' } });
    }
  }
  outputs.push(['manifest.json', Buffer.from(JSON.stringify({ schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository',
    inputs, documents, generatedIntermediates: intermediates }, null, 2) + '\n')]);
  return { outputs, measured: provenance.measured, grids: grids.map(g => ({ id: g.id, peak: g.built.peak, voxels: g.built.filled })) };
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const check = process.argv.includes('--check');
  const selected = process.argv.find(arg => arg.startsWith('--default='))?.slice(10);
  const result = await author(selected);
  await mkdir(root, { recursive: true });
  for (const [name, bytes] of result.outputs) {
    const target = resolve(root, name);
    if (check) {
      const existing = await readFile(target).catch(() => null);
      if (!existing || !existing.equals(bytes)) throw new Error(`Authored output differs: ${name}`);
    } else await writeFile(target, bytes);
  }
  console.log(`${check ? 'CHECKED' : 'AUTHORED'} betelgeuse-shell: ${JSON.stringify(result.measured)}; grid ${GRID.size}^3; ${JSON.stringify(result.grids)}`);
}
