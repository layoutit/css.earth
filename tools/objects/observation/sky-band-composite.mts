/** Survey sky bands -> one asinh display raster and its TAN WCS.
 * The route owns every calibration factor, or states that a band has none, and which acquisition each band may use; a recipe names
 * bands, a grid, one background and one peak percentile for every band, and one common display.
 * Each band is divided by its own measured range, the usual survey false-colour practice, because
 * infrared bands differ in brightness by an order of magnitude. No authored gain, crop or rotation. */
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { readFitsFileHdus, readFitsFileRegion, readFitsImage } from '../../fits/fits.mts';
import { skyDisplayRaster, skyImageAxes, skyProjection } from '../../fits/fits-sky.mts';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { asinhBandDisplay, asinhBandEvidence, encodeAsinhBands, type AsinhBandDisplay } from '../color-transfer.mts';
import { maskSaturatedStars } from './plate-saturation.mts';
import { findPointSources } from './point-sources.mts';
import { JWST_BANDS, JWST_UNITS_REFERENCE, bandOfHeader, type JwstBand } from '../jwst/imaging/bands.mts';
import { runImage3 } from '../jwst/imaging/image3.mts';
import { binWiseAtlasTile, gridWcs, parseSkyGrid, matchTileBackgrounds, mosaicTiles, MONTAGE_BACKGROUND_REFERENCE, parseTilePins, readWiseAtlasTile,
  WISE_ATLAS_REFERENCE, wiseAtlasUrl, type SkyGrid, type WiseBand } from './wise-atlas-mosaic.mts';

export const HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits';
const WISE_ATLAS_PIXEL_SR = (1.375 / 206264.80624709636) ** 2;
const WISE = 'https://wise2.ipac.caltech.edu/docs/release/allsky/expsup/sec2_3f.html';
const IRAC = 'https://irsa.ipac.caltech.edu/data/SPITZER/docs/irac/iracinstrumenthandbook/46/';
const DSS = 'https://archive.stsci.edu/dss/';
const HERSCHEL_HIPS = 'https://alasky.cds.unistra.fr/MocServer/query?ID=ESAVO%2FP%2FHERSCHEL%2F';
export const MAST_PRODUCT_URL = 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:JWST/product/';

interface SkyBand {
  readonly label: string;
  /** WISE HiPS carry a separate level per atlas tile (measured), so WISE is mosaicked from the atlas tiles. */
  readonly acquisition: { readonly kind: 'hips2fits'; readonly hips: string } | { readonly kind: 'wise-atlas'; readonly band: WiseBand } |
    { readonly kind: 'jwst'; readonly band: JwstBand };
  /** Multiply a source value (DN or MJy/sr) to get diffuse surface brightness in MJy/sr; null when the
   * published product has no documented flux calibration, so values stay in relative source units. */
  readonly toMJyPerSr: number | null;
  readonly calibration: string;
  readonly reference: string;
  /** Scanned plates saturate; their flat-cored stars and halos are measured and reported as no coverage. */
  readonly saturates?: true;
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
  DSS2B: dss('DSS2 blue (SERC-J / POSS-II J)', 'blue'),
  DSS2R: dss('DSS2 red (AAO-SES / SERC-ER / POSS-II F)', 'red'),
  PACS100: herschel('Herschel PACS 100 µm', 'PACS100'),
  PACS160: herschel('Herschel PACS 160 µm', 'PACS160'),
  SPIRE250: herschel('Herschel SPIRE 250 µm', 'SPIRE-250'),
  // A coronagraph band is a PSF-subtracted image of one star's surroundings, not a band of the sky.
  ...Object.fromEntries(Object.values(JWST_BANDS).filter(entry => !entry.coronagraph).map(entry => [entry.id, jwst(entry)])),
});
/** JWST imaging bands (tools/objects/jwst/imaging/bands.mts): surface brightness in MJy/sr after the pipeline's photom step,
 * either MAST's level-3 mosaic or the pipeline's image3 stage re-run onto the recipe grid. */
function jwst(entry: JwstBand): SkyBand {
  return { label: entry.label, acquisition: { kind: 'jwst', band: entry }, toMJyPerSr: 1, reference: JWST_UNITS_REFERENCE,
    calibration: 'JWST pipeline imaging product in MJy/sr, calibrated by the pipeline\u2019s photom step; used as delivered.' };
}
function wise(label: string, band: WiseBand, janskyPerDn: number): SkyBand {
  return { label, acquisition: { kind: 'wise-atlas', band }, toMJyPerSr: janskyPerDn / WISE_ATLAS_PIXEL_SR / 1e6, reference: WISE,
    calibration: `AllWISE atlas DN x ${janskyPerDn} Jy/DN / 1.375 arcsec atlas pixel. No colour correction: it depends on the unknown spectrum.` };
}
function irac(label: string, channel: number, factor: number): SkyBand {
  return { label, acquisition: { kind: 'hips2fits', hips: `CDS/P/SPITZER/IRAC${channel}` }, toMJyPerSr: factor, reference: IRAC,
    calibration: `CDS IRAC HiPS MJy/sr x ${factor} infinite-aperture surface-brightness correction (good to 10%).` };
}

/** Scanned photographic plates: plate density, not flux. The digitized values respond nonlinearly and differ
 * from plate to plate, so the route claims no calibration and cannot remove plate-to-plate level steps. */
function dss(label: string, colour: 'blue' | 'red'): SkyBand {
  return { label, acquisition: { kind: 'hips2fits', hips: `CDS/P/DSS2/${colour}` }, toMJyPerSr: null, reference: DSS, saturates: true,
    calibration: 'Relative photographic units: CDS HiPS of STScI digitized Schmidt plate scans. Plate response is nonlinear and plate-dependent; no flux calibration, linearization or plate-level matching is applied.' };
}
/** ESASky HiPS of the public Herschel Science Archive maps. Neither the HiPS record nor the hips2fits header declares
 * a brightness unit, and the archive's PACS and SPIRE map products use different units, so no factor is claimed. */
function herschel(label: string, hips: string): SkyBand {
  return { label, acquisition: { kind: 'hips2fits', hips: `ESAVO/P/HERSCHEL/${hips}` }, toMJyPerSr: null, reference: `${HERSCHEL_HIPS}${encodeURIComponent(hips)}&get=record&fmt=json`,
    calibration: 'Relative source units: ESASky HiPS of public Herschel Science Archive maps; the HiPS declares no unit. NaN outside the observed footprint stays missing.' };
}

type Pin = { readonly path: string };
export type SkyBandInput = { readonly band: string; readonly bytes: number; readonly product?: undefined } | { readonly band: string; readonly tiles: Pin } |
  { readonly band: string; readonly product: string; readonly bytes: number } |
  { readonly band: string; readonly program: string };
export interface SkyBandComposite {
  readonly schema: 'cssearth-sky-band-composite@1';
  readonly grid: SkyGrid;
  readonly bands: readonly SkyBandInput[];
  readonly backgroundPercentile: number;
  readonly peakPercentile: number;
  readonly display: AsinhBandDisplay;
  /** How the composite reports pixels no band observed: as black bytes, or as an alpha channel a consumer can read. */
  readonly coverage: 'black' | 'alpha';
  /** 'mask' reports stars found on each band as no coverage (point-sources.mts), for lenses that place the image in depth. */
  readonly pointSources?: 'mask';
}

const digest = (value: unknown, label: string) => { const text = requireString(value, label); if (!/^[0-9a-f]{64}$/u.test(text)) throw new TypeError(`${label} must be a SHA-256.`); return text; };
const repositoryPath = (value: unknown) => {
  const path = requireString(value, 'Tile list path');
  if (path.startsWith('/') || path.split('/').includes('..') || !path.endsWith('.json')) throw new TypeError('Tile lists are repository-relative JSON files.');
  return path;
};

export function parseSkyBandComposite(value: unknown): SkyBandComposite {
  const row = requireRecord(value, 'Sky band composite');
  const required = ['backgroundPercentile', 'bands', 'display', 'grid', 'peakPercentile', 'schema'], optional = ['coverage', 'pointSources'];
  if (row.schema !== 'cssearth-sky-band-composite@1' || required.some(key => !Object.hasOwn(row, key)) ||
      Object.keys(row).some(key => !required.includes(key) && !optional.includes(key)))
    throw new TypeError('Unsupported sky band composite.');
  if (row.pointSources !== undefined && row.pointSources !== 'mask') throw new TypeError('Point sources are either kept or masked.');
  const coverage = row.coverage === undefined ? 'black' : row.coverage;
  if (coverage !== 'black' && coverage !== 'alpha') throw new TypeError('Coverage is reported as black bytes or as an alpha channel.');
  const grid = parseSkyGrid(row.grid);
  const bands = requireArray(row.bands).map((raw): SkyBandInput => {
    const band = requireRecord(raw, 'Sky band'), id = requireString(band.band, 'Band'), route = Object.hasOwn(SKY_BANDS, id) ? SKY_BANDS[id]! : undefined;
    if (route?.acquisition.kind === 'hips2fits' && Object.keys(band).sort().join() === 'band,bytes') {
      const bytes = requireFiniteNumber(band.bytes, 'Band bytes');
      if (!Number.isSafeInteger(bytes) || bytes < 2880) throw new TypeError(`Invalid ${id} byte count.`);
      return { band: id, bytes };
    }
    if (route?.acquisition.kind === 'jwst' && Object.keys(band).sort().join() === 'band,program') {
      const program = requireString(band.program, `${id} program`);
      if (!/^[A-Za-z0-9._-]+$/u.test(program)) throw new TypeError(`Invalid ${id} image3 program.`);
      return { band: id, program };
    }
    if (route?.acquisition.kind === 'jwst' && Object.keys(band).sort().join() === 'band,bytes,product') {
      const product = requireString(band.product, `${id} product`), bytes = requireFiniteNumber(band.bytes, 'Band bytes');
      if (!/^jw\d{5}-[a-z0-9]+_t\d{3}_(?:nircam|miri)_[a-z0-9-]+_i2d\.fits$/u.test(product)) throw new TypeError(`${id}: not a JWST level-3 i2d product name.`);
      if (!Number.isSafeInteger(bytes) || bytes < 2880) throw new TypeError(`Invalid ${id} byte count.`);
      return { band: id, product, bytes };
    }
    if (route?.acquisition.kind === 'wise-atlas' && Object.keys(band).sort().join() === 'band,tiles') {
      const tiles = requireRecord(band.tiles, 'Tile list pin');
      return { band: id, tiles: { path: repositoryPath(tiles.path) } };
    }
    throw new TypeError(`Unsupported sky band or acquisition: ${id}`);
  });
  const percentile = requireFiniteNumber(row.backgroundPercentile, 'Background percentile');
  const peak = requireFiniteNumber(row.peakPercentile, 'Peak percentile');
  if (!(percentile >= 0 && percentile <= 50 && peak >= 90 && peak <= 100)) throw new TypeError('Background percentile must lie in [0, 50] and peak percentile in [90, 100].');
  return { schema: row.schema, grid, bands, coverage, ...(row.pointSources === 'mask' ? { pointSources: 'mask' as const } : {}),
    backgroundPercentile: percentile, peakPercentile: peak, display: asinhBandDisplay(bands.map(band => band.band), row.display) };
}

export function skyBandUrl(grid: SkyGrid, hips: string): string {
  const { width, height, fovDeg, centerIcrsDegrees: [ra, dec] } = grid;
  const query = new URLSearchParams({ hips, width: String(width), height: String(height), projection: 'TAN', fov: String(fovDeg),
    coordsys: 'icrs', ra: String(ra), dec: String(dec), format: 'fits' });
  return `${HIPS2FITS}?${query}`;
}

export interface SkyBandIo {
  /** Repository-relative, pinned JSON (tile lists). */
  readonly input: (path: string) => Promise<Buffer>;
  /** Cache for downloaded hips2fits responses and atlas tiles. */
  readonly cache: string;
  readonly progress?: (message: string) => void;
}

/** The cache names a hips2fits response by its request URL. */
async function hips2fitsBytes(grid: SkyGrid, band: { band: string; bytes: number }, hips: string, cache: string) {
  const url = skyBandUrl(grid, hips), path = resolve(cache, 'hips2fits', `${sha256(url)}.fits`);
  let bytes = await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null) {
    const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok) throw new Error(`Sky band download failed: ${response.status} ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== band.bytes) throw new Error(`Changed hips2fits response: ${url}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  }
  if (bytes.length !== band.bytes) throw new Error(`Changed sky band input: ${path}`);
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

/** Download a MAST product into the cache by streaming, never holding it whole, and return its size; the file is stored under
 * its product name. `expected` refuses a response of another size. */
export async function acquireMastProduct(product: string, cache: string, expected?: { bytes: number }) {
  const url = `${MAST_PRODUCT_URL}${product}`, response = await fetch(url, { signal: AbortSignal.timeout(3_600_000) });
  if (!response.ok || !response.body) throw new Error(`MAST download failed: ${response.status} ${url}`);
  const part = resolve(cache, 'mast', `${product}.part`);
  await mkdir(dirname(part), { recursive: true });
  await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(part));
  const pin = await sha256File(part);
  if (expected && pin.bytes !== expected.bytes) { await rm(part, { force: true }); throw new Error(`Changed MAST product: ${url}`); }
  await rename(part, resolve(cache, 'mast', product));
  return pin;
}

/** A named MAST product in the cache, downloaded when missing. */
async function mastProductPath(input: { band: string; product: string; bytes: number }, cache: string) {
  const path = resolve(cache, 'mast', input.product);
  let size = await stat(path).then(entry => entry.size).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (size === null) size = (await acquireMastProduct(input.product, cache, input)).bytes;
  if (size !== input.bytes) throw new Error(`Changed sky band input: ${path}`);
  return path;
}

/** A JWST level-3 mosaic resampled onto the grid: each grid pixel is the mean of k x k bilinear samples of the mosaic, k the
 * ratio of the grid pixel to the mosaic pixel (at least 1, at most 8), so the grid averages rather than aliases. Only the
 * mosaic rows the grid covers are read. NaN, which the pipeline writes where no exposure contributed, stays missing. */
async function mastProductPlane(grid: SkyGrid, input: { band: string; product: string; bytes: number }, band: JwstBand, cache: string) {
  const path = await mastProductPath(input, cache), hdus = await readFitsFileHdus(path), primary = hdus[0]!.header;
  if (bandOfHeader(primary)?.id !== band.id)
    throw new Error(`${input.product}: not a ${band.instrument} ${band.filter}${band.pupil ? `/${band.pupil}` : ''} product.`);
  const sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (!sci || sci.header.BUNIT !== 'MJy/sr') throw new Error(`${input.product}: no SCI extension in MJy/sr.`);
  const mosaic = skyProjection(sci.header), wcs = gridWcs(grid);
  const onGrid = skyProjection({ CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRPIX1: wcs.referencePixel[0], CRPIX2: wcs.referencePixel[1],
    CRVAL1: wcs.referenceValueDeg[0], CRVAL2: wcs.referenceValueDeg[1], CDELT1: wcs.scaleDeg[0], CDELT2: wcs.scaleDeg[1] });
  const { width, height } = grid, [fullWidth, fullHeight] = sci.dimensions as [number, number];
  const k = Math.min(8, Math.max(1, Math.ceil(onGrid.scaleArcsec / mosaic.scaleArcsec)));
  // The mosaic pixels the grid's edge reaches bound the rows and columns to read.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let t = 0; t <= 1; t += 1 / 256) for (const [gx, gy] of [[t * width, 0], [t * width, height], [0, t * height], [width, t * height]] as const) {
    const at = mosaic.pixelOf(...onGrid.skyOf(gx - 0.5, gy - 0.5));
    if (at) { minX = Math.min(minX, at[0]); maxX = Math.max(maxX, at[0]); minY = Math.min(minY, at[1]); maxY = Math.max(maxY, at[1]); }
  }
  const plane = new Float32Array(width * height).fill(NaN);
  const x0 = Math.max(0, Math.floor(minX) - 1), y0 = Math.max(0, Math.floor(minY) - 1);
  const x1 = Math.min(fullWidth, Math.ceil(maxX) + 2), y1 = Math.min(fullHeight, Math.ceil(maxY) + 2);
  if (x1 <= x0 || y1 <= y0) return { plane, k, region: null };
  const region = await readFitsFileRegion(path, sci, { x0, y0, width: x1 - x0, height: y1 - y0 }), rw = region.width, rv = region.values;
  const sample = (px: number, py: number) => {
    const fx = px - x0, fy = py - y0, ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix + 1 >= rw || iy + 1 >= region.height) return NaN;
    const a = fx - ix, b = fy - iy, o = iy * rw + ix;
    return (1 - a) * (1 - b) * rv[o]! + a * (1 - b) * rv[o + 1]! + (1 - a) * b * rv[o + rw]! + a * b * rv[o + rw + 1]!;
  };
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    // Top raster row first: FITS grid row height - 1 - row.
    const fitsRow = height - 1 - row;
    let sum = 0, count = 0;
    for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) {
      const at = mosaic.pixelOf(...onGrid.skyOf(column - 0.5 + (u + 0.5) / k, fitsRow - 0.5 + (v + 0.5) / k));
      const value = at ? sample(at[0], at[1]) : NaN;
      if (Number.isFinite(value)) { sum += value; count++; }
    }
    if (count === k * k) plane[row * width + column] = sum / count;
  }
  return { plane, k, region: { x0, y0, width: x1 - x0, height: y1 - y0 }, header: primary, mosaicScaleArcsec: mosaic.scaleArcsec };
}

/** The image3 stage's mosaic on the recipe grid, named by program and band. A re-run reproduces its SCI data exactly
 * (measured). It is taken from the cache, or built by tools/objects/jwst/imaging/image3.mts from the program's members.
 * The mosaic must be the grid itself (shape, reference and scale) with no rotation, so it is only flipped into display order. */
async function image3Plane(grid: SkyGrid, input: { band: string; program: string }, band: JwstBand, io: SkyBandIo) {
  const path = resolve(io.cache, 'jwst-image3', `${input.program}-${band.id}.fits`);
  let run: Record<string, unknown> | undefined;
  const present = await stat(path).then(() => true).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
  if (!present) {
    io.progress?.(`${input.band}: running the image3 stage for ${input.program}`);
    const built = await runImage3(input.program, band.id, resolve(io.cache, 'jwst-image3', 'work', input.program, band.id), { grid });
    await mkdir(dirname(path), { recursive: true }); await rename(built.mosaic, path);
    run = { seconds: built.seconds, peakRssBytes: built.peakRssBytes, members: built.members };
  }
  const hdus = await readFitsFileHdus(path), primary = hdus[0]!.header, sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (bandOfHeader(primary)?.id !== band.id || !sci || sci.header.BUNIT !== 'MJy/sr') throw new Error(`${input.band}: not a ${band.id} image3 mosaic in MJy/sr.`);
  const wcs = gridWcs(grid), axes = skyImageAxes(sci.header), [width, height] = sci.dimensions as [number, number];
  const number = (key: string) => requireFiniteNumber(sci.header[key], `FITS ${key}`);
  if (width !== grid.width || height !== grid.height || Math.abs(number('CRVAL1') - wcs.referenceValueDeg[0]) > 1e-9 || Math.abs(number('CRVAL2') - wcs.referenceValueDeg[1]) > 1e-9 ||
      Math.abs(number('CRPIX1') - wcs.referencePixel[0]) > 1e-6 || Math.abs(number('CRPIX2') - wcs.referencePixel[1]) > 1e-6 ||
      axes.eastRight || !axes.northUp || Math.abs(axes.scale[1] - Math.abs(wcs.scaleDeg[1])) > 1e-6 * Math.abs(wcs.scaleDeg[1]))
    throw new Error(`${input.band}: the image3 mosaic is not on the recipe grid.`);
  const region = await readFitsFileRegion(path, sci, { x0: 0, y0: 0, width, height });
  return { plane: skyDisplayRaster(Float32Array.from(region.values), width, height, axes), header: primary, run };
}

/** One band on the grid, in its source unit, top raster row first; NaN where nothing was observed. */
async function bandPlane(recipe: SkyBandComposite, input: SkyBandInput, io: SkyBandIo) {
  const route = SKY_BANDS[input.band]!, { width, height } = recipe.grid;
  if ('bytes' in input && input.product === undefined && route.acquisition.kind === 'hips2fits') {
    const hips = route.acquisition.hips, image = readFitsImage(await hips2fitsBytes(recipe.grid, input, hips, io.cache), { maxDecodedBytes: 1024 ** 3 });
    checkHips2fits(image.header, image.cards, hips, recipe.grid);
    const plane = skyDisplayRaster(Float32Array.from(image.values), width, height, skyImageAxes(image.header));
    return { plane, acquisition: { kind: 'hips2fits', hips, url: skyBandUrl(recipe.grid, hips), bytes: input.bytes,
      limits: 'CDS hips2fits interpolates HiPS pixels by an undocumented method.' } };
  }
  if ('program' in input && route.acquisition.kind === 'jwst') {
    const { plane, header, run } = await image3Plane(recipe.grid, input, route.acquisition.band, io);
    return { plane, acquisition: { kind: 'jwst-image3', program: input.program,
      program_file: `tools/objects/jwst/imaging/programs/${input.program}.json`, pipeline: header.CAL_VER, crdsContext: header.CRDS_CTX, ...(run ? { run } : {}),
      limits: 'The pipeline\u2019s image3 stage (tweakreg, skymatch, outlier detection, resample) re-run from MAST\u2019s level-2 members onto the recipe grid, north up, so the exposures are resampled once. Pixels no exposure covered are missing.' } };
  }
  if ('product' in input && input.product !== undefined && route.acquisition.kind === 'jwst') {
    const { plane, k, region, header, mosaicScaleArcsec } = await mastProductPlane(recipe.grid, input, route.acquisition.band, io.cache);
    const jwstBand = route.acquisition.band;
    return { plane, acquisition: { kind: 'mast-product', product: input.product, url: `${MAST_PRODUCT_URL}${input.product}`, bytes: input.bytes,
      instrument: jwstBand.instrument, filter: jwstBand.filter, ...(jwstBand.pupil ? { pupil: jwstBand.pupil } : {}),
      ...(header ? { program: header.PROGRAM, observed: header['DATE-BEG'], pipeline: header.CAL_VER, crdsContext: header.CRDS_CTX } : {}),
      mosaicPixelArcsec: mosaicScaleArcsec ?? null, samplesPerAxis: k, mosaicRegion: region,
      limits: 'Each grid pixel is the mean of k x k bilinear samples of the mosaic; a grid pixel any of whose samples falls outside the exposures is missing. The mosaic is used as the JWST pipeline calibrated it, including its astrometry.' } };
  }
  if ('tiles' in input && route.acquisition.kind === 'wise-atlas') {
    const listBytes = await io.input(input.tiles.path);
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
    io.progress?.(`${input.band}: matched ${matched.tiles.length} tile levels over ${matched.pairs} overlaps`);
    for (const tile of matched.excluded) io.progress?.(`${input.band}: left out ${tile.coaddId} (${tile.pixels} pixels, all covered by joined tiles)`);
    return { plane: mosaicTiles(matched.tiles, matched.offsets, recipe.grid), acquisition: { kind: 'wise-atlas', tiles: input.tiles, tileCount: pins.tiles.length, excludedTiles: matched.excluded,
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

/** Every band on the grid, calibrated and divided by its own measured range, before any display: one float per band per
 * pixel (band-interleaved, top row first), the pixels no band observed or masked (`missing`), and among them the pixels a
 * point-source mask removed from observed sky (`masked`). A consumer with its own transfer, such as a volume
 * whose renderer applies 1 - exp(-gain * column), reads these instead of display bytes, so the image is not stretched twice. */
export async function composeSkyBandPlanes(recipe: SkyBandComposite, io: SkyBandIo) {
  const { width, height } = recipe.grid, count = width * height, bandCount = recipe.bands.length;
  const values = new Float32Array(count * bandCount), missing = new Uint8Array(count), masked = new Uint8Array(count), bands = [];
  for (const [b, input] of recipe.bands.entries()) {
    const route = SKY_BANDS[input.band]!, { plane, acquisition } = await bandPlane(recipe, input, io);
    // A saturated plate star is not galaxy light and not zero: its flat core and halo become no coverage.
    const saturation = route.saturates ? maskSaturatedStars(plane, width, height) : undefined;
    if (saturation) io.progress?.(`${input.band}: masked ${saturation.stars.length} saturated plate stars over ${saturation.maskedPixels} pixels`);
    const points = recipe.pointSources === 'mask' ? findPointSources(plane, width, height) : undefined;
    if (points) {
      for (let pixel = 0; pixel < count; pixel++) if (points.mask[pixel] && Number.isFinite(plane[pixel]!)) { plane[pixel] = NaN; masked[pixel] = 1; }
      io.progress?.(`${input.band}: masked ${points.cores} star cores over ${points.maskedPixels} pixels`);
    }
    let missingPixels = 0;
    for (let pixel = 0; pixel < count; pixel++) {
      if (Number.isFinite(plane[pixel]!)) plane[pixel] = plane[pixel]! * (route.toMJyPerSr ?? 1);
      else { missing[pixel] = 1; missingPixels++; }
    }
    // The survey products carry no absolute zero level: one measured background per band, and one
    // measured peak that sets that band's range.
    const [background, peak] = percentilesOf(plane, recipe.backgroundPercentile, recipe.peakPercentile) as [number, number];
    if (!(peak > background)) throw new Error(`${input.band}: no signal between the background and peak percentiles.`);
    for (let pixel = 0; pixel < count; pixel++)
      values[pixel * bandCount + b] = Number.isFinite(plane[pixel]!) ? (plane[pixel]! - background) / (peak - background) : 0;
    const levels = route.toMJyPerSr === null ? { backgroundSourceUnits: background, peakSourceUnits: peak } : { backgroundMJyPerSr: background, peakMJyPerSr: peak };
    bands.push({ band: input.band, label: route.label, acquisition, toMJyPerSr: route.toMJyPerSr, calibration: route.calibration, reference: route.reference,
      ...levels, missingPixels, ...(points ? { pointSources: { cores: points.cores, spikeRays: points.spikeRays, spikePixels: points.spikePixels, maskedPixels: points.maskedPixels, robustDeviation: points.robustDeviation, settings: points.settings } } : {}), ...(saturation ? { saturation: { ...saturation, stars: saturation.stars.length,
        maskedRadiusPixels: [Math.min(...saturation.stars.map(star => star.maskedRadius), Infinity), Math.max(...saturation.stars.map(star => star.maskedRadius), 0)],
        brightestStars: saturation.stars.slice(0, 8) } } : {}) });
    io.progress?.(`${input.band}: ${route.toMJyPerSr === null ? 'relative units' : 'calibrated'}; background ${background.toFixed(3)} and peak ${peak.toFixed(3)} ${route.toMJyPerSr === null ? 'source units' : 'MJy/sr'}`);
  }
  return { width, height, values, missing, masked, bands };
}

/** DOM row order (top row first), one RGB byte triple per pixel, with the grid's TAN WCS. */
export async function composeSkyBands(recipe: SkyBandComposite, io: SkyBandIo) {
  const { width, height, values, missing, bands } = await composeSkyBandPlanes(recipe, io), count = width * height;
  const encoded = encodeAsinhBands(values, missing, recipe.display);
  const channels = recipe.coverage === 'alpha' ? 4 as const : 3 as const;
  let rgb = encoded;
  if (channels === 4) {
    rgb = Buffer.alloc(count * 4);
    for (let pixel = 0; pixel < count; pixel++) {
      rgb.set(encoded.subarray(pixel * 3, pixel * 3 + 3), pixel * 4);
      rgb[pixel * 4 + 3] = missing[pixel] ? 0 : 255;
    }
  }
  return { width, height, rgb, channels, wcs: gridWcs(recipe.grid), missingPixels: missing.reduce((sum, value) => sum + value, 0),
    evidence: { schema: 'cssearth-sky-band-composite-evidence@1', grid: recipe.grid, wcs: gridWcs(recipe.grid),
      backgroundPercentile: recipe.backgroundPercentile, peakPercentile: recipe.peakPercentile, bands, display: asinhBandEvidence(recipe.display),
      coverage: recipe.coverage === 'alpha'
        ? 'Pixels no band observed, including masked saturated plate stars, carry alpha 0. Consumers read that channel as no coverage; their colour bytes are black and must not be read as zero brightness.'
        : 'Pixels no band observed are black bytes; this composite has no coverage channel.',
      limits: 'The survey products have no absolute zero level, so each band loses one measured background. Bands without a documented calibration stay in relative source units. Dividing each band by its own range means hue does not show physical band ratios. Missing pixels are black. Rows are reversed once from FITS order into top-down raster order.' } };
}

/** Read a recipe and every tile list it names. Callers run this before trusting a cached composite, so a
 * missing recipe fails the same way with a warm or a cold cache. */
export async function verifySkyBandRecipe(recipePin: { readonly path: string }, input: SkyBandIo['input']) {
  const recipeBytes = await input(recipePin.path);
  const recipe = parseSkyBandComposite(JSON.parse(recipeBytes.toString('utf8')));
  const files = [{ path: recipePin.path, bytes: recipeBytes.length }];
  for (const band of recipe.bands) if ('tiles' in band) {
    const list = await input(band.tiles.path);
    parseTilePins(JSON.parse(list.toString('utf8')));
    files.push({ path: band.tiles.path, bytes: list.length });
  }
  return { recipe, files };
}

/** The recipe's composite as a deterministic lossless RGB8 PNG: the lab working raster and the app preview source. */
export async function composeSkyBandPng(recipePin: { readonly path: string }, io: SkyBandIo) {
  const { recipe } = await verifySkyBandRecipe(recipePin, io.input);
  const composed = await composeSkyBands(recipe, io);
  const bytes = await sharp(composed.rgb, { raw: { width: composed.width, height: composed.height, channels: composed.channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  return { bytes, sha256: sha256(bytes), width: composed.width, height: composed.height, wcs: composed.wcs, missingPixels: composed.missingPixels,
    evidence: { ...composed.evidence, recipe: recipePin, output: { sha256: sha256(bytes), bytes: bytes.length, format: 'png', channels: composed.channels, bitDepth: 8 } } };
}
