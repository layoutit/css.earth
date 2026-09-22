import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceArray, sourceObject, sourceText, sourcePath } from '../../src/platform/source-catalog.mts';
import { fetchWithRetry, sourceCacheUrl, RUNTIME_ASSET_ORIGIN } from '../assets/source-mirror.mts';

const root = resolve(import.meta.dirname, '../..');

export interface AcquireGalaxyFieldOptions {
  /** Project root; only used to resolve catalogPath/directory when they are left relative. */
  root?: string;
  /** Repository-relative path to the pinned source catalogue. */
  catalogPath?: string;
  /** Repository-relative directory the pinned TSVs are cached under (must match each pin's own `path`). */
  directory?: string;
  /** Opt-in (default null/off): the real content-addressed mirror origin, named explicitly by a production caller
   * (the CLI entry point below). Left off by default so an ordinary test or import never makes a surprise real
   * request to it. */
  mirrorOrigin?: string | null;
  fetcher?: typeof fetch;
}

/**
 * Acquire the 3 VizieR galaxy-field catalogues (cosmicflows-4, hyperleda-pgc, hyperleda-hi), checking each against
 * its recorded row count. Three tiers, cheapest first:
 *   1. an already-cached local file with the recorded row count;
 *   2. (when `mirrorOrigin` is set) our own mirror at `source-cache/galaxy-field/<id>.tsv`; a miss, a short file or
 *      any mirror error falls straight through to VizieR;
 *   3. the recorded VizieR TAP query itself, which stays the recorded provenance either way.
 * A clean build that has the mirror populated therefore never needs to reach VizieR at all.
 */
export async function acquireGalaxyFieldSources({ root: projectRoot = root,
  catalogPath = 'src/objects/nearby-universe/source/catalogue.json', directory = '.local/galaxy-field/sources',
  mirrorOrigin = null, fetcher = fetch }: AcquireGalaxyFieldOptions = {}): Promise<void> {
  const pinned = sourceObject(JSON.parse(await readFile(resolve(projectRoot, catalogPath), 'utf8')));
  if (pinned.schema !== 'cssearth-galaxy-field-sources@1') throw new TypeError('Invalid field sources.');
  await mkdir(resolve(projectRoot, directory), { recursive: true });
  await Promise.all(sourceArray(pinned.sources, sourceObject).map(async source => {
    const id = sourceText(source.id), path = sourcePath(source.path);
    if (path !== `${directory}/${id}.tsv` || !Number.isSafeInteger(source.rows)) throw new TypeError('Invalid source record.');
    const absolutePath = resolve(projectRoot, path);
    const complete = (bytes: Buffer) => { const content = bytes.toString('utf8'); return content.startsWith('PGC\t') && content.trim().split('\n').length - 1 === source.rows; };
    const cached = await readFile(absolutePath).catch(() => null);
    if (cached && complete(cached)) { console.log(`${id}: cache`); return; }
    if (mirrorOrigin) {
      const mirrorUrl = sourceCacheUrl(mirrorOrigin, 'galaxy-field', `${id}.tsv`);
      const mirrored = await fetchWithRetry(fetcher, mirrorUrl, { idleMs: 5000, attempts: 1 })
        .then(candidate => complete(candidate) ? candidate : null)
        .catch(() => null);
      if (mirrored) { await writeFile(absolutePath, mirrored); console.log(`${id}: mirror cache`); return; }
    }
    const url = new URL('https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync');
    for (const [key, value] of Object.entries({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', MAXREC: '1000000', QUERY: sourceText(source.query) })) url.searchParams.set(key, value);
    if (url.href !== source.url) throw new TypeError(`Acquisition URL does not match the recorded query: ${id}`);
    const response = await fetcher(url, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!complete(bytes)) throw new Error(`Changed source response: ${id}; review the row count before accepting.`);
    await writeFile(absolutePath, bytes); console.log(`${id}: ${source.rows} rows, ${bytes.length} bytes`);
  }));
  console.log('Galaxy field sources restored.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await acquireGalaxyFieldSources({ mirrorOrigin: RUNTIME_ASSET_ORIGIN });
}
