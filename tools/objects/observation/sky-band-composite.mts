/** Calibrated survey sky bands -> one asinh display raster and its TAN WCS.
 * The route owns every calibration factor and which acquisition each band may use; a recipe names
 * bands, a grid, one background and one peak percentile for every band, and one common display.
 * Each band is divided by its own measured range, the usual survey false-colour practice, because
 * infrared bands differ in brightness by an order of magnitude. No authored gain, crop or rotation. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readFitsImage } from '../../fits.mts';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { asinhBandDisplay, asinhBandEvidence, encodeAsinhBands, type AsinhBandDisplay } from '../color-transfer.mts';
import { binWiseAtlasTile, gridWcs, matchTileBackgrounds, mosaicTiles, MONTAGE_BACKGROUND_REFERENCE, parseTilePins, readWiseAtlasTile,
  WISE_ATLAS_REFERENCE, wiseAtlasUrl, type SkyGrid, type WiseBand } from './wise-atlas-mosaic.mts';

export const HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits';
const WISE_ATLAS_PIXEL_SR = (1.375 / 206264.80624709636) ** 2;
const WISE = 'https://wise2.ipac.caltech.edu/docs/release/allsky/expsup/sec2_3f.html';
const IRAC = 'https://irsa.ipac.caltech.edu/data/SPITZER/docs/irac/iracinstrumenthandbook/46/';

interface SkyBand {
  readonly label: string;
  /** WISE HiPS carry a separate level per atlas tile (measured), so WISE is mosaicked from the atlas tiles. */
  readonly acquisition: { readonly kind: 'hips2fits'; readonly hips: string } | { readonly kind: 'wise-atlas'; readonly band: WiseBand };
  /** Multiply a source value (DN or MJy/sr) to get diffuse surface brightness in MJy/sr. */
  readonly toMJyPerSr: number;
  readonly calibration: string;
  readonly reference: string;
}

/** WISE Explanatory Supplement section II.3.f Table 1 DN-to-Jy factors for 1.375 arcsec atlas pixels, which
 * that section says apply to diffuse emission above the local background. The CDS IRAC HiPS are MJy/sr mosaics
 * (checked against GLIMPSE); IRAC Instrument Handbook Table 8.2 gives the surface-brightness factors. */
export const SKY_BANDS: Readonly<Record<string, SkyBand>> = Object.freeze({
  W1: wise('WISE W1 3.4 µm', 'W1', 1.9350e-6),
  W2: wise('WISE W2 4.6 µm', 'W2', 2.7048e-6),
  W3: wise('WISE W3 12 µm', 'W3', 1.8326e-6),
  W4: wise('WISE W4 22 µm', 'W4', 5.2269e-5),
  IRAC1: irac('Spitzer IRAC 3.6 µm', 1, 0.91),
  IRAC2: irac('Spitzer IRAC 4.5 µm', 2, 0.94),
  IRAC4: irac('Spitzer IRAC 8.0 µm', 4, 0.74),
});
function wise(label: string, band: WiseBand, janskyPerDn: number): SkyBand {
  return { label, acquisition: { kind: 'wise-atlas', band }, toMJyPerSr: janskyPerDn / WISE_ATLAS_PIXEL_SR / 1e6, reference: WISE,
    calibration: `AllWISE atlas DN x ${janskyPerDn} Jy/DN / 1.375 arcsec atlas pixel. No colour correction: it depends on the unknown spectrum.` };
}
function irac(label: string, channel: number, factor: number): SkyBand {
  return { label, acquisition: { kind: 'hips2fits', hips: `CDS/P/SPITZER/IRAC${channel}` }, toMJyPerSr: factor, reference: IRAC,
    calibration: `CDS IRAC HiPS MJy/sr x ${factor} infinite-aperture surface-brightness correction (good to 10%).` };
}

type Pin = { readonly path: string; readonly sha256: string };
export type SkyBandInput = { readonly band: string; readonly sha256: string; readonly bytes: number } | { readonly band: string; readonly tiles: Pin };
export interface SkyBandComposite {
  readonly schema: 'cssearth-sky-band-composite@1';
  readonly grid: SkyGrid;
  readonly bands: readonly SkyBandInput[];
  readonly backgroundPercentile: number;
  readonly peakPercentile: number;
  readonly display: AsinhBandDisplay;
}

const digest = (value: unknown, label: string) => { const text = requireString(value, label); if (!/^[0-9a-f]{64}$/u.test(text)) throw new TypeError(`${label} must be a SHA-256.`); return text; };
const repositoryPath = (value: unknown) => {
  const path = requireString(value, 'Tile list path');
  if (path.startsWith('/') || path.split('/').includes('..') || !path.endsWith('.json')) throw new TypeError('Tile lists are repository-relative JSON files.');
  return path;
};

export function parseSkyBandComposite(value: unknown): SkyBandComposite {
  const row = requireRecord(value, 'Sky band composite'), grid = requireRecord(row.grid, 'Sky band grid');
  if (row.schema !== 'cssearth-sky-band-composite@1' || Object.keys(row).sort().join() !== 'backgroundPercentile,bands,display,grid,peakPercentile,schema')
    throw new TypeError('Unsupported sky band composite.');
  const size = (n: unknown) => { const v = requireFiniteNumber(n, 'Grid size'); if (!Number.isSafeInteger(v) || v < 16) throw new TypeError('Invalid grid size.'); return v; };
  const width = size(grid.width), height = size(grid.height), fovDeg = requireFiniteNumber(grid.fovDeg, 'Grid field');
  const center = requireArray(grid.centerIcrsDegrees).map(n => requireFiniteNumber(n, 'Grid centre'));
  // CDS hips2fits refuses requests above 50 million pixels; the atlas mosaic keeps the same grid limit.
  if (width * height > 50_000_000 || !(fovDeg > 0 && fovDeg < 90) || center.length !== 2 || !(center[0]! >= 0 && center[0]! < 360) || Math.abs(center[1]!) > 90)
    throw new TypeError('Invalid sky grid.');
  const bands = requireArray(row.bands).map((raw): SkyBandInput => {
    const band = requireRecord(raw, 'Sky band'), id = requireString(band.band, 'Band'), route = Object.hasOwn(SKY_BANDS, id) ? SKY_BANDS[id]! : undefined;
    if (route?.acquisition.kind === 'hips2fits' && Object.keys(band).sort().join() === 'band,bytes,sha256') {
      const bytes = requireFiniteNumber(band.bytes, 'Band bytes');
      if (!Number.isSafeInteger(bytes) || bytes < 2880) throw new TypeError(`Invalid ${id} byte count.`);
      return { band: id, sha256: digest(band.sha256, `${id} sha256`), bytes };
    }
    if (route?.acquisition.kind === 'wise-atlas' && Object.keys(band).sort().join() === 'band,tiles') {
      const tiles = requireRecord(band.tiles, 'Tile list pin');
      return { band: id, tiles: { path: repositoryPath(tiles.path), sha256: digest(tiles.sha256, `${id} tile list sha256`) } };
    }
    throw new TypeError(`Unsupported sky band or acquisition: ${id}`);
  });
  const percentile = requireFiniteNumber(row.backgroundPercentile, 'Background percentile');
  const peak = requireFiniteNumber(row.peakPercentile, 'Peak percentile');
  if (!(percentile >= 0 && percentile <= 50 && peak >= 90 && peak <= 100)) throw new TypeError('Background percentile must lie in [0, 50] and peak percentile in [90, 100].');
  return { schema: row.schema, grid: { width, height, fovDeg, centerIcrsDegrees: [center[0]!, center[1]!] }, bands,
    backgroundPercentile: percentile, peakPercentile: peak, display: asinhBandDisplay(bands.map(band => band.band), row.display) };
}

export function skyBandUrl(grid: SkyGrid, hips: string): string {
  const { width, height, fovDeg, centerIcrsDegrees: [ra, dec] } = grid;
  const query = new URLSearchParams({ hips, width: String(width), height: String(height), projection: 'TAN', fov: String(fovDeg),
    coordsys: 'icrs', ra: String(ra), dec: String(dec), format: 'fits' });
  return `${HIPS2FITS}?${query}`;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export interface SkyBandIo {
  /** Repository-relative, pinned JSON (tile lists). */
  readonly input: (path: string) => Promise<Buffer>;
  /** Cache for downloaded hips2fits responses and atlas tiles. */
  readonly cache: string;
  readonly progress?: (message: string) => void;
}

async function hips2fitsBytes(grid: SkyGrid, band: { band: string; sha256: string; bytes: number }, hips: string, cache: string) {
  const path = resolve(cache, 'hips2fits', `${band.sha256}.fits`);
  let bytes = await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null) {
    const url = skyBandUrl(grid, hips), response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok) throw new Error(`Sky band download failed: ${response.status} ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== band.bytes || sha256(bytes) !== band.sha256) throw new Error(`Changed hips2fits response: ${url}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  }
  if (bytes.length !== band.bytes || sha256(bytes) !== band.sha256) throw new Error(`Changed sky band input: ${path}`);
  return bytes;
}

/** hips2fits header checks: the requested grid, the named HiPS, no rotation, distortion or unit card. */
function checkHips2fits(header: Record<string, unknown>, cards: readonly string[], hips: string, grid: SkyGrid) {
  const expected = gridWcs(grid), number = (key: string) => requireFiniteNumber(header[key], `FITS ${key}`);
  if (header.NAXIS !== 2 || header.NAXIS1 !== grid.width || header.NAXIS2 !== grid.height || header.CTYPE1 !== 'RA---TAN' || header.CTYPE2 !== 'DEC--TAN' ||
      header.RADESYS !== 'ICRS' || header.CUNIT1 !== 'deg' || header.CUNIT2 !== 'deg' || (header.LONPOLE !== undefined && header.LONPOLE !== 180) ||
      Math.abs(number('CRVAL1') - grid.centerIcrsDegrees[0]) > 1e-9 || Math.abs(number('CRVAL2') - grid.centerIcrsDegrees[1]) > 1e-9 ||
      number('CRPIX1') !== expected.referencePixel[0] || number('CRPIX2') !== expected.referencePixel[1] ||
      // CDS prints the increments to 17 significant digits; they differ from the grid formula only in the last one.
      Math.abs(number('CDELT1') - expected.scaleDeg[0]) > 1e-9 * expected.scaleDeg[1] || Math.abs(number('CDELT2') - expected.scaleDeg[1]) > 1e-9 * expected.scaleDeg[1])
    throw new Error(`${hips}: hips2fits grid differs from the recipe.`);
  if (Object.keys(header).some(key => /^(?:CD\d_\d|PC\d_\d|CROTA\d|PV\d_\d+|BUNIT)$/u.test(key)))
    throw new Error(`${hips}: unexpected rotation, distortion or unit cards.`);
  if (!cards.some(card => card.startsWith('HISTORY') && card.includes(`From HiPS ${hips} `)))
    throw new Error(`${hips}: FITS history does not name this HiPS.`);
}

/** One band on the grid, in its source unit, top raster row first; NaN where nothing was observed. */
async function bandPlane(recipe: SkyBandComposite, input: SkyBandInput, io: SkyBandIo) {
  const route = SKY_BANDS[input.band]!, { width, height } = recipe.grid;
  if ('sha256' in input && route.acquisition.kind === 'hips2fits') {
    const hips = route.acquisition.hips, image = readFitsImage(await hips2fitsBytes(recipe.grid, input, hips, io.cache), { maxDecodedBytes: 1024 ** 3 });
    checkHips2fits(image.header, image.cards, hips, recipe.grid);
    const plane = new Float32Array(width * height);
    for (let fitsRow = 0; fitsRow < height; fitsRow++) plane.set(image.values.subarray(fitsRow * width, (fitsRow + 1) * width), (height - 1 - fitsRow) * width);
    return { plane, acquisition: { kind: 'hips2fits', hips, url: skyBandUrl(recipe.grid, hips), sha256: input.sha256, bytes: input.bytes,
      limits: 'CDS hips2fits interpolates HiPS pixels by an undocumented method.' } };
  }
  if ('tiles' in input && route.acquisition.kind === 'wise-atlas') {
    const listBytes = await io.input(input.tiles.path);
    if (sha256(listBytes) !== input.tiles.sha256) throw new Error(`Changed WISE atlas tile list: ${input.tiles.path}`);
    const pins = parseTilePins(JSON.parse(listBytes.toString('utf8')));
    if (pins.band !== route.acquisition.band) throw new Error(`${input.tiles.path} lists ${pins.band} tiles, not ${route.acquisition.band}.`);
    const binned = [], outside = [];
    for (const [index, tile] of pins.tiles.entries()) {
      const tileBin = binWiseAtlasTile(await readWiseAtlasTile(pins, tile, resolve(io.cache, 'wise-atlas')), pins, tile.coaddId, recipe.grid);
      if (tileBin) binned.push(tileBin); else outside.push(tile.coaddId);
      if ((index + 1) % 25 === 0) io.progress?.(`${input.band}: binned ${index + 1}/${pins.tiles.length} atlas tiles`);
    }
    if (outside.length) throw new Error(`${input.band}: pinned atlas tiles miss the grid: ${outside.join(', ')}`);
    const matched = matchTileBackgrounds(binned);
    io.progress?.(`${input.band}: matched ${binned.length} tile levels over ${matched.pairs} overlaps`);
    return { plane: mosaicTiles(binned, matched.offsets, recipe.grid), acquisition: { kind: 'wise-atlas', tiles: input.tiles, tileCount: pins.tiles.length,
      urlPattern: wiseAtlasUrl('{coadd_id}', route.acquisition.band), reference: WISE_ATLAS_REFERENCE, backgroundMatching: {
        method: 'One additive level per atlas tile, solved by least squares from the median difference in every overlap of at least 200 output pixels, with a zero-mean gauge (Montage mBgModel with constant terms).',
        reference: MONTAGE_BACKGROUND_REFERENCE, overlaps: matched.pairs, solverIterations: matched.sweeps,
        medianOverlapStepDnBefore: matched.medianPairStepBefore, medianOverlapStepDnAfter: matched.medianPairStepAfter,
        levelRangeDn: [Math.min(...matched.offsets), Math.max(...matched.offsets)] },
      limits: 'Each output pixel is the mean of the atlas pixel centres that land in it, so pixels finer than about two atlas pixels can alias. Atlas headers declare equinox 2000; WISE astrometry is tied to 2MASS, which the ICRS grid treats as ICRS.' } };
  }
  throw new TypeError(`Unsupported sky band acquisition: ${input.band}`);
}

function percentilesOf(values: Float32Array, ...percentiles: number[]): number[] {
  const finite = values.filter(Number.isFinite).sort();
  if (!finite.length) throw new Error('A sky band has no observed pixels.');
  return percentiles.map(percentile => finite[Math.floor(percentile / 100 * (finite.length - 1))]!);
}

/** DOM row order (top row first), one RGB byte triple per pixel, with the grid's TAN WCS. */
export async function composeSkyBands(recipe: SkyBandComposite, io: SkyBandIo) {
  const { width, height } = recipe.grid, count = width * height, bandCount = recipe.bands.length;
  const values = new Float32Array(count * bandCount), missing = new Uint8Array(count), bands = [];
  for (const [b, input] of recipe.bands.entries()) {
    const route = SKY_BANDS[input.band]!, { plane, acquisition } = await bandPlane(recipe, input, io);
    let missingPixels = 0;
    for (let pixel = 0; pixel < count; pixel++) {
      if (Number.isFinite(plane[pixel]!)) plane[pixel] = plane[pixel]! * route.toMJyPerSr;
      else { missing[pixel] = 1; missingPixels++; }
    }
    // The survey products carry no absolute zero level: one measured background per band, and one
    // measured peak that sets that band's range.
    const [background, peak] = percentilesOf(plane, recipe.backgroundPercentile, recipe.peakPercentile) as [number, number];
    if (!(peak > background)) throw new Error(`${input.band}: no signal between the background and peak percentiles.`);
    for (let pixel = 0; pixel < count; pixel++)
      values[pixel * bandCount + b] = Number.isFinite(plane[pixel]!) ? (plane[pixel]! - background) / (peak - background) : 0;
    bands.push({ band: input.band, label: route.label, acquisition, toMJyPerSr: route.toMJyPerSr, calibration: route.calibration, reference: route.reference,
      backgroundMJyPerSr: background, peakMJyPerSr: peak, missingPixels });
    io.progress?.(`${input.band}: calibrated; background ${background.toFixed(3)} and peak ${peak.toFixed(3)} MJy/sr`);
  }
  const rgb = encodeAsinhBands(values, missing, recipe.display);
  return { width, height, rgb, wcs: gridWcs(recipe.grid), missingPixels: missing.reduce((sum, value) => sum + value, 0),
    evidence: { schema: 'cssearth-sky-band-composite-evidence@1', grid: recipe.grid, wcs: gridWcs(recipe.grid),
      backgroundPercentile: recipe.backgroundPercentile, peakPercentile: recipe.peakPercentile, bands, display: asinhBandEvidence(recipe.display),
      limits: 'The survey products have no absolute zero level, so each band loses one measured background. Dividing each band by its own range means hue does not show physical band ratios. Missing pixels are black. Rows are reversed once from FITS order into top-down raster order.' } };
}
