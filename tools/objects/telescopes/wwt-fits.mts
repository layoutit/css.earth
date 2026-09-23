/** Acquire one original numeric WWT FITS tile and expose it through Telescope's science backend. */
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { plotProduct } from '../astronomy-packages/plots.mts';
import { writeProductRecord } from '../product-record.mts';

const MAX_TILE_BYTES = 8 * 1024 * 1024;
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const index = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a nonnegative whole number.`);
  return value;
};

function tileUrl(template: string, level: number, x: number, y: number): string {
  if ((template.match(/\{1\}/gu) ?? []).length !== 1 ||
      (template.match(/\{2\}/gu) ?? []).length !== 1 ||
      (template.match(/\{3\}/gu) ?? []).length < 1 ||
      /\{[^}]*\}/u.test(template.replaceAll('{1}', '').replaceAll('{2}', '').replaceAll('{3}', '')))
    throw new TypeError('Unsupported WWT FITS level/x/y URL template.');
  const url = new URL(template.replaceAll('{1}', String(level)).replaceAll('{2}', String(x)).replaceAll('{3}', String(y)));
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('WWT FITS tile URL must use HTTP or HTTPS.');
  url.protocol = 'https:'; // Historical WWT WTML uses HTTP; retrieve unchanged bytes over TLS.
  if (!/\.fits?(?:$|\?)/iu.test(url.href)) throw new TypeError('WWT FITS tile URL must address FITS bytes.');
  return url.href;
}

async function boundedTile(response: Response, url: string): Promise<Buffer> {
  if (!response.ok || !response.body) throw new Error(`WWT FITS request failed (${response.status}): ${url}`);
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > MAX_TILE_BYTES) throw new RangeError('WWT FITS tile exceeds the 8 MiB limit.');
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > MAX_TILE_BYTES) { await response.body.cancel().catch(() => {}); throw new RangeError('WWT FITS tile exceeds the 8 MiB limit.'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

export interface WwtFitsResult {
  readonly directory: string; readonly source: string; readonly data: string;
  readonly values: string; readonly figure: string; readonly receipt: string;
  readonly status: 'unresolved'; readonly limitations: readonly string[];
}

export async function acquireWwtFits(catalogPath: string, setName: string, level: number, x: number, y: number,
  outputDirectory: string, request: (url: string) => Promise<Response> = url => fetch(url, { signal: AbortSignal.timeout(20_000) })): Promise<WwtFitsResult> {
  index(level, '--level'); index(x, '--x'); index(y, '--y');
  const catalogBytes = await readFile(catalogPath), catalog = requireRecord(JSON.parse(catalogBytes.toString('utf8')), 'WWT FITS catalog');
  if (catalog.schema !== 'cssearth-wwt-fits-catalog@1') throw new TypeError('Expected a WWT FITS catalog snapshot.');
  const source = requireRecord(catalog.source, 'WWT FITS catalog source');
  const sourceFile = requireString(source.file, 'WTML filename');
  if (basename(sourceFile) !== sourceFile || !/^[^/\\]+\.wtml$/iu.test(sourceFile)) throw new TypeError('WTML filename must be local to the catalog.');
  if (source.parser !== 'wwt-data-formats@0.18.1' || new URL(requireString(source.url, 'WTML URL')).protocol !== 'https:')
    throw new TypeError('WWT FITS catalog needs its pinned parser and HTTPS source URL.');
  const wtmlBytes = await readFile(resolve(dirname(catalogPath), sourceFile));
  if (digest(wtmlBytes) !== requireString(source.sha256, 'WTML SHA-256')) throw new Error('WWT source WTML differs from the pinned catalog.');
  const sets = requireArray(catalog.imagesets, 'WWT FITS imagesets');
  const matches = sets.filter(row => requireRecord(row, 'WWT FITS imageset').name === setName);
  if (matches.length !== 1) throw new TypeError(`Select exactly one WWT FITS imageset by name; found ${matches.length} named ${setName}.`);
  const selected = requireRecord(matches[0], 'selected WWT FITS imageset');
  const position = requireRecord(selected.position, 'WWT FITS position');
  if (!['.fits', '.fit'].includes(requireString(selected.fileType, 'WWT file type').toLowerCase()) ||
      requireString(selected.dataSetType, 'WWT dataset type') !== 'Sky' ||
      requireString(selected.projection, 'WWT projection') !== 'Tan')
    throw new TypeError('This WWT FITS route supports TAN sky FITS imagesets.');
  const maximum = position.tileLevels;
  if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0 || level > maximum || level > 20)
    throw new TypeError('Requested WWT FITS level is outside the catalog range.');
  if (x >= 2 ** level || y >= 2 ** level) throw new TypeError('Tile x/y are outside this level.');
  const url = tileUrl(requireString(selected.urlTemplate, 'WWT FITS template'), level, x, y), destination = resolve(outputDirectory);
  try { await lstat(destination); throw new TypeError('Output directory already exists; choose a new --out directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const bytes = await boundedTile(await request(url), url);
  if (!bytes.subarray(0, 80).toString('ascii').startsWith('SIMPLE  =')) throw new TypeError('WWT returned a non-FITS tile.');
  await mkdir(dirname(destination), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(destination), '.wwt-fits-'));
  try {
    const original = resolve(staging, 'source.fits');
    await writeFile(original, bytes);
    const inspected = requireRecord(await sciencePackage({ operation: 'fits', path: original }), 'Astropy FITS inspection');
    const structures = requireArray(inspected.structures, 'FITS structures').map(row => requireRecord(row, 'FITS structure'));
    const science = structures.filter(row => row.fitsHdu === 0 && Array.isArray(row.shape) && row.shape.length === 2);
    if (science.length !== 1) throw new TypeError('WWT FITS tile needs exactly one two-dimensional primary science array.');
    const shape = requireArray(science[0]!.shape, 'science shape').map(value => requireFiniteNumber(value, 'science dimension'));
    if (shape[0] !== 256 || shape[1] !== 256) throw new TypeError('WWT FITS tile must have a 256 × 256 primary array.');
    const extraction = requireRecord(await sciencePackage({ operation: 'extract', path: original, hdu: 0, kind: 'image', arrayDirectory: resolve(staging, 'arrays') }), 'FITS extraction');
    const extracted = requireArray(extraction.structures, 'extracted structures').map(row => requireRecord(row, 'extracted structure')).find(row => row.fitsHdu === 0);
    if (!extracted?.extraction) throw new Error('Astropy did not extract the selected FITS primary array.');
    const plotted = requireRecord(await plotProduct(staging, requireString(selected.name, 'WWT FITS name'), requireRecord(extracted.extraction, 'image extraction'), original, { kind: 'image', hdu: 0 }), 'image products');
    const limitations = [...new Set([
      ...requireArray(science[0]!.limitations, 'science limitations').map(value => requireString(value, 'science limitation')),
      'WWT tile positioning comes from WTML; the tile FITS header alone does not establish celestial WCS.',
      'WWT tile retrieval does not establish the original untiled source product identity or calibration.',
    ])];
    const report = { schema: 'cssearth-wwt-fits@1', status: 'unresolved', imageset: selected, tile: { level, x, y, url, bytes: bytes.length, sha256: digest(bytes) },
      catalog: { sourceUrl: source.url, sourceSha256: source.sha256, snapshotSha256: digest(catalogBytes) },
      inspection: { structure: science[0]!.structure, shape, quality: science[0]!.quality, unit: extracted.extraction && requireRecord(extracted.extraction).unit },
      limitations };
    await writeFile(resolve(staging, 'source.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(resolve(staging, 'catalog.json'), catalogBytes);
    await writeFile(resolve(staging, 'source.wtml'), wtmlBytes);
    const outputNames = requireArray(plotted.files, 'science products').map(value => requireString(value, 'science product'));
    if (outputNames.length !== 4 || ['figure.png', 'figure.svg', 'values.csv', 'image.fits'].some(name => !outputNames.includes(name)))
      throw new Error('Astropy plotting returned an unexpected science product list.');
    const implementation = digest(Buffer.concat(await Promise.all([
      new URL('wwt-fits.mts', import.meta.url), new URL('../astronomy-packages/science.mts', import.meta.url),
      new URL('../astronomy-packages/plots.mts', import.meta.url),
    ].map(path => readFile(path)))));
    await writeProductRecord(resolve(staging, 'output.product.json'), {
      telescope: 'WorldWideTelescope hosted FITS collection', stage: 'telescope-wwt-fits',
      inputs: [
        { role: 'WWT FITS catalog snapshot', identity: resolve(catalogPath), bytes: catalogBytes.length, sha256: digest(catalogBytes) },
        { role: 'WTML collection', identity: requireString(source.url, 'WTML URL'), bytes: wtmlBytes.length, sha256: digest(wtmlBytes) },
        { role: 'FITS tile', identity: url, bytes: bytes.length, sha256: digest(bytes) },
      ],
      parameters: { imageset: requireString(selected.name, 'WWT FITS name'), level, x, y, status: 'unresolved', limitations, sourceInspection: science[0] },
      software: [{ name: 'cssEarth Telescope WWT FITS', version: implementation }, { name: 'wwt-data-formats catalog parser', version: '0.18.1' },
        { name: 'Astropy', version: requireString(inspected.astropy, 'Astropy version') },
        { name: 'Matplotlib', version: requireString(plotted.matplotlib, 'Matplotlib version') }],
    }, [{ path: 'source.fits', file: original }, { path: 'source.json', file: resolve(staging, 'source.json') },
      { path: 'catalog.json', file: resolve(staging, 'catalog.json') }, { path: 'source.wtml', file: resolve(staging, 'source.wtml') },
      ...outputNames.map(path => ({ path, file: resolve(staging, path) }))]);
    await rm(resolve(staging, 'arrays'), { recursive: true, force: true });
    await rename(staging, destination);
    return { directory: destination, source: resolve(destination, 'source.fits'), data: resolve(destination, 'image.fits'),
      values: resolve(destination, 'values.csv'), figure: resolve(destination, 'figure.png'), receipt: resolve(destination, 'output.product.json'),
      status: 'unresolved', limitations };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
