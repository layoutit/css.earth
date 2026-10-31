/** Official AllWISE native-pixel cutouts. Acquisition/calibration only; no density model. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { readFitsImage, skyProjection, type FitsHeader } from '@cssearth/fits';

type Band = 3 | 4;
type Kind = 'int' | 'unc' | 'cov';
interface Region { coadd: string; center: [number, number]; size: string }
interface Product { band: Band; kind: Kind; coadd: string; path: string; url: string; parentUrl: string; bytes: number; decodedBytes: number; width: number; height: number; header: FitsHeader; stats: ReturnType<typeof statistics>; elapsedSeconds: number }
const ROOT = resolve('.local/infrared/wise');
const BASE = 'https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd';
// IV.4.h Table1 column2, constant Fnu equivalent: matches the heating grid's photon-count response.
// Table IV.3.a's conventional factors use F*nu0 instead and differ substantially in broad W3.
const FNU_ZERO: Record<Band, number> = { 3: 31.674, 4: 8.363 };
const CONVERSION: Record<Band, number> = { 3: FNU_ZERO[3] * 10 ** (-.4 * 18), 4: FNU_ZERO[4] * 10 ** (-.4 * 13) };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
async function json(path: string, value: unknown): Promise<void> { await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
function statistics(values: Float64Array | Float32Array) {
  let missing = 0, negative = 0, zero = 0, min = Infinity, max = -Infinity, sum = 0;
  const samples: number[] = [], stride = Math.max(1, Math.floor(values.length / 200_000));
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) { missing++; continue; }
    if (v < 0) negative++; if (v === 0) zero++; min = Math.min(min, v); max = Math.max(max, v); sum += v;
    if (i % stride === 0) samples.push(v);
  }
  samples.sort((a, b) => a - b);
  const q = (fraction: number) => samples.length ? samples[Math.floor((samples.length - 1) * fraction)]! : null;
  return { pixels: values.length, finite: values.length - missing, missing, negative, zero, min: min === Infinity ? null : min, max: max === -Infinity ? null : max,
    mean: values.length > missing ? sum / (values.length - missing) : null, p01: q(.01), p50: q(.5), p99: q(.99), p998: q(.998), quantileSamples: samples.length };
}
function uncompressed(bytes: Buffer): Buffer { return bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 100_000_000 }) : bytes; }
async function request(url: string, maximumBytes: number): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw Error(`IRSA ${response.status}: ${url}`);
  const length = Number(response.headers.get('content-length'));
  if (length > maximumBytes) throw Error(`Response exceeds ${maximumBytes} bytes: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maximumBytes) throw Error(`Downloaded response exceeds bound: ${url}`);
  return bytes;
}
async function cached(path: string, url: string, maximumBytes: number): Promise<Buffer> {
  try { return await readFile(path); } catch (error: unknown) { if (!record(error) || error.code !== 'ENOENT') throw error; }
  const bytes = await request(url, maximumBytes);
  await writeFile(path + '.partial', bytes); await rename(path + '.partial', path); return bytes;
}
async function acquire(directory: string, region: Region, band: Band, kind: Kind): Promise<Product> {
  const start = performance.now(), stem = `${region.coadd}-w${band}-${kind}-3`, parentUrl = `${BASE}/${region.coadd.slice(0, 2)}/${region.coadd.slice(0, 4)}/${region.coadd}/${stem}.fits.gz`;
  const query = new URLSearchParams({ center: region.center.join(','), size: region.size, gzip: 'true' }), url = `${parentUrl}?${query}`;
  const path = join(directory, `${stem}.fits.gz`), bytes = await cached(path, url, 85_000_000), decoded = uncompressed(bytes);
  const image = readFitsImage(decoded, { maxDecodedBytes: 160_000_000 }), h = image.header;
  if (h.COADDID !== region.coadd || h.BAND !== band || h.BITPIX !== -32 || h.NAXIS !== 2 || h.CTYPE1 !== 'RA---SIN' || h.CTYPE2 !== 'DEC--SIN' || h.EQUINOX !== 2000 || h.CROTA2 !== 0) throw Error(`Unexpected atlas identity/WCS: ${path}`);
  if (kind !== 'cov' && h.BUNIT !== 'DN' || kind === 'cov' && h.BUNIT !== 'effective pixels') throw Error(`Unexpected ${kind} units: ${String(h.BUNIT)}`);
  if (h.MAGZP !== (band === 3 ? 18 : 13) || !finite(h.CDELT1) || !finite(h.CDELT2) || Math.abs(Math.abs(h.CDELT1) * 3600 - 1.375) > 1e-5 || Math.abs(Math.abs(h.CDELT2) * 3600 - 1.375) > 1e-5) throw Error(`Unexpected WISE calibration/pixel scale: ${path}`);
  const product: Product = { band, kind, coadd: region.coadd, path, url, parentUrl, bytes: bytes.length, decodedBytes: decoded.length, width: image.width, height: image.height, header: h, stats: statistics(image.values), elapsedSeconds: (performance.now() - start) / 1000 };
  await json(path.replace('.fits.gz', '.header.json'), { immutableParentUrl: parentUrl, requested: region, receivedCompressed: bytes[0] === 0x1f && bytes[1] === 0x8b, ...product });
  console.log(JSON.stringify({ signal: 'WISE_PRODUCT_READY', coadd: region.coadd, band, kind, width: image.width, height: image.height, bytes: bytes.length, missing: product.stats.missing }));
  return product;
}
async function f32(path: string, values: Float32Array): Promise<void> {
  const bytes = Buffer.alloc(values.length * 4); for (let i = 0; i < values.length; i++) bytes.writeFloatLE(values[i]!, i * 4); await writeFile(path, bytes);
}
async function exportTriplet(directory: string, products: Product[], band: Band, coadd: string) {
  const find = (kind: Kind) => { const p = products.find(p => p.band === band && p.coadd === coadd && p.kind === kind); if (!p) throw Error(`Missing ${kind}`); return p; };
  const ip = find('int'), up = find('unc'), cp = find('cov');
  const [intensity, uncertainty, coverage] = await Promise.all([ip, up, cp].map(async p => readFitsImage(uncompressed(await readFile(p.path)), { maxDecodedBytes: 160_000_000 })));
  if (!intensity || !uncertainty || !coverage || intensity.width !== uncertainty.width || intensity.height !== uncertainty.height || intensity.width !== coverage.width || intensity.height !== coverage.height) throw Error('Atlas triplet dimensions do not agree.');
  for (const key of ['CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2', 'CDELT1', 'CDELT2']) if (intensity.header[key] !== uncertainty.header[key] || intensity.header[key] !== coverage.header[key]) throw Error(`Triplet WCS differs: ${key}`);
  const h = intensity.header;
  if (!finite(h.CDELT1) || !finite(h.CDELT2)) throw Error('Missing pixel scale.');
  const solidAngle = Math.abs(h.CDELT1 * h.CDELT2) * (Math.PI / 180) ** 2, factor = CONVERSION[band] / solidAngle / 1e6;
  const n = intensity.values.length, plane = new Float32Array(n), sigma = new Float32Array(n), cov = Float32Array.from(coverage.values), observed = new Uint8Array(n), flags = new Uint8Array(n);
  let lowCoverage = 0, unknown = 0;
  for (let p = 0; p < n; p++) {
    const i = intensity.values[p]!, u = uncertainty.values[p]!, c = coverage.values[p]!;
    plane[p] = Number.isFinite(i) ? i * factor : NaN; sigma[p] = Number.isFinite(u) ? u * factor : NaN;
    const good = Number.isFinite(i) && Number.isFinite(u) && u > 0 && Number.isFinite(c) && c > 0;
    observed[p] = good ? 255 : 0;
    if (!good) { flags[p] |= 1; unknown++; }
    if (Number.isFinite(c) && c < 6) { flags[p] |= 2; lowCoverage++; }
  }
  const stem = join(directory, `${coadd}-w${band}`);
  await f32(stem + '.mjysr.f32', plane); await f32(stem + '.uncertainty-mjysr.f32', sigma); await f32(stem + '.coverage.f32', cov);
  await writeFile(stem + '.observed.u8', observed); await writeFile(stem + '.quality.u8', flags);
  const nativeWcs = skyProjection(h), namedRows = (await readFile('.local/named-stars.csv', 'utf8')).trim().split(/\r?\n/u).slice(1);
  const knownStars = namedRows.map(line => { const cells = line.split(','), ra = Number(cells[1]), dec = Number(cells[2]); if (!Number.isFinite(ra) || !Number.isFinite(dec)) throw Error('Named-star position invalid.'); const pixel = nativeWcs.pixelOf(ra, dec); return { hip: Number(cells[0]), ra, dec, fitsStoredPixel: pixel, inside: !!pixel && pixel[0] >= 0 && pixel[1] >= 0 && pixel[0] < intensity.width && pixel[1] < intensity.height }; });
  const sourceStats = statistics(plane), lo = sourceStats.p01 ?? 0, hi = sourceStats.p998 ?? 1, scale = Math.max(1e-12, hi - lo), bytes = new Uint8Array(n);
  for (let p = 0; p < n; p++) bytes[p] = observed[p] ? Math.min(255, Math.round(255 * Math.asinh(8 * Math.max(0, plane[p]! - lo) / scale) / Math.asinh(8))) : 0;
  await sharp(bytes, { raw: { width: intensity.width, height: intensity.height, channels: 1 } }).flip().resize({ width: 800, withoutEnlargement: true }).png().toFile(stem + '.preview.png');
  const exported = { band, coadd, width: intensity.width, height: intensity.height, header: h, factorDnToMJySr: factor, absoluteZeroPointKnown: false,
    calibration: { convention: 'constant Fnu photon-count equivalent; matches heating-grid flat-Fnu normalization', fnuZeroJy: FNU_ZERO[band], janskyPerDn: CONVERSION[band], reference: 'https://irsa.ipac.caltech.edu/data/WISE/docs/release/All-Sky/expsup/sec4_4h.html', table: 'Table1 column2; DN factor Fnu0*10^(-0.4*MAGZP)', standardAtlasJanskyPerDn: band === 3 ? 1.8326e-6 : 5.2269e-5, ratioToStandardAtlasFactor: CONVERSION[band] / (band === 3 ? 1.8326e-6 : 5.2269e-5), colorCorrection: 'none: compare directly to identically normalized synthetic band integrals; W4 red-source/RSR systematic remains' },
    sourceProducts: [ip, up, cp].map(p => ({ kind: p.kind, path: p.path, url: p.url, bytes: p.bytes })),
    arrays: { order: 'row-major, original FITS stored rows; first row southern edge, RA decreases along x; no flip or resampling', type: 'little-endian float32', intensity: `${coadd}-w${band}.mjysr.f32`, uncertainty: `${coadd}-w${band}.uncertainty-mjysr.f32`, coverage: `${coadd}-w${band}.coverage.f32`, observed: `${coadd}-w${band}.observed.u8`, quality: `${coadd}-w${band}.quality.u8` },
    quality: { unknown, lowCoverageBelow6: lowCoverage, flagBits: { 1: 'nonfinite intensity/uncertainty/coverage, nonpositive uncertainty or zero coverage: unknown, not zero dust', 2: 'coverage below6; weak/outlier-vulnerable' }, perPixelArtifactMaskAvailable: false, saturation: 'NaN/zero-coverage holes detected; missed saturation can remain and is not excluded by finite values', compactSourcesRemoved: false },
    psf: { nativeDetectorFwhmArcsec: band === 3 ? 6.7 : 11.8, effectiveAtlasFwhmArcsec: band === 3 ? 9.5 : 16.8, atlasPixelArcsec: 1.375, suggestedCommonFwhmArcsec: 18, reference: 'AllWISE IV.4.l; global ballpark, actual local asymmetric PRF should be measured' },
    statisticsMJySr: sourceStats, uncertaintyStatisticsMJySr: statistics(sigma), coverageStatistics: statistics(cov), knownStars,
    limitations: ['Relative diffuse excess only; unknown additive level per atlas tile', 'No SED color correction; PAH/VSG stochastic emission is not an equilibrium temperature or direct column', 'Atlas uncertainty pixels are correlated; raw sigma is not independent per-pixel likelihood', 'No point-source subtraction performed; supplied stars/catalogue must be handled separately; missing cores stay unknown', 'Preserved native cutout WCS; service changes CRPIX/dimensions only, no geometric resampling'] };
  await json(stem + '.export.json', exported); return exported;
}

async function metadata(directory: string): Promise<void> {
  const url = 'https://irsa.ipac.caltech.edu/ibe/search/wise/allwise/p3am_cdd?POS=56.55,24.11&SIZE=1.8&INTERSECT=OVERLAPS&ct=csv';
  const bytes = await cached(join(ROOT, 'atlas-query.csv'), url, 2_000_000);
  if (!bytes.toString('utf8').startsWith('in_row_id,')) throw Error('IBE metadata query returned non-CSV.');
  const query = "SELECT TOP 100000 designation,ra,dec,w3mpro,w3sigmpro,w3snr,w4mpro,w4sigmpro,w4snr,cc_flags,ph_qual,ext_flg,w3sat,w4sat FROM allwise_p3as_psd WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',56.55,24.11,1.05))";
  const catalogueUrl = 'https://irsa.ipac.caltech.edu/TAP/sync?' + new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', MAXREC: '100000', QUERY: query });
  try { const catalogue = await cached(join(ROOT, 'allwise-sources-complete.csv'), catalogueUrl, 12_000_000); if (!catalogue.toString('utf8').startsWith('designation,')) throw Error('Catalogue is not expected CSV.'); await json(join(ROOT, 'catalogue-query.json'), { success: true, path: 'allwise-sources-complete.csv', earlierTruncatedQuery: 'allwise-sources.csv (TOP10000; retained, not used)', url: catalogueUrl, bytes: catalogue.length, query, warning: 'Includes point sources and knots in nebulosity; catalogue presence alone is not grounds for deleting diffuse emission.' }); }
  catch (error: unknown) { await json(join(ROOT, 'catalogue-query.json'), { success: false, url: catalogueUrl, error: String(error) }); }
  await json(join(directory, 'request.json'), { centerIcrsDegrees: [56.55, 24.11], requestedPhotoDegrees: [1.2, .85], margin: 'full stage extends at least~0.2deg past optical footprint within native atlas coverage', atlasQueryUrl: url, coadds: ['0561p242_ac51', '0577p242_ac51'], release: 'AllWISE2013, W3/W4 cryogenic2010 observations', zeroPoint: 'relative diffuse intensity only; per-tile additive backgrounds uncalibrated', implementation: 'shared @cssearth/fits parser and native SIN WCS; no geometry, no optical image reads' });
}
async function main(): Promise<void> {
  const mode = process.argv[2]; if (mode !== 'pilot' && mode !== 'full' && mode !== 'metadata') throw Error('Usage: node packages/telescope-cli/authoring/m45/wise.mts pilot|full|metadata');
  if (mode === 'metadata') { await metadata(ROOT); return; }
  const directory = join(ROOT, mode); await mkdir(directory, { recursive: true });
  if (mode === 'full') { const pilot: unknown = JSON.parse(await readFile(join(ROOT, 'pilot', 'receipt.json'), 'utf8')); if (!record(pilot) || pilot.success !== true) throw Error('Full acquisition needs successful exact-code pilot.'); }
  const start = performance.now(), regions: Region[] = mode === 'pilot' ? [{ coadd: '0561p242_ac51', center: [56.55, 24.11], size: '128pix' }] : [
    { coadd: '0561p242_ac51', center: [56.30, 24.12], size: '1.30,1.28deg' },
    { coadd: '0577p242_ac51', center: [57.20, 24.12], size: '.85,1.28deg' },
  ];
  const products: Product[] = [];
  for (const region of regions) for (const kind of ['int', 'unc', 'cov'] satisfies Kind[]) {
    const pair = await Promise.all(([3, 4] satisfies Band[]).map(band => acquire(directory, region, band, kind))); products.push(...pair);
  }
  const exports = [];
  for (const region of regions) for (const band of [3, 4] satisfies Band[]) exports.push(await exportTriplet(directory, products, band, region.coadd));
  await metadata(directory);
  const receipt = { success: true, signal: 'WISE_ACQUISITION_QUALIFIED', mode, products: products.map(({ header, stats, ...rest }) => rest), exports: exports.map(e => ({ band: e.band, coadd: e.coadd, width: e.width, height: e.height, factorDnToMJySr: e.factorDnToMJySr, quality: e.quality })), totalTransferredBytes: products.reduce((sum, p) => sum + p.bytes, 0), elapsedSeconds: (performance.now() - start) / 1000 };
  await json(join(directory, 'receipt.json'), receipt); console.log(JSON.stringify(receipt));
}
await main();
