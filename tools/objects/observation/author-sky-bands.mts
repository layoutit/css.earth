/** Author the pins of a sky band composite recipe: hips2fits responses and AllWISE atlas tile lists.
 * Usage: node tools/objects/observation/author-sky-bands.mts <recipe.json> [--cache=.local/nebula-lab/sky-bands]
 * A band without pins is acquired and pinned; existing pins are verified, never silently replaced.
 * WISE tiles come from the IRSA IBE atlas search around the grid; a tile is kept when any sample of its
 * published footprint edges or its centre projects inside the grid. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { hasErrorCode, requireArray, requireRecord, requireString } from '../../source-values.mts';
import { parseSkyBandComposite, SKY_BANDS, skyBandUrl } from './sky-band-composite.mts';
import { gridWcs, skyToGridPixel, WISE_ATLAS_BANDS, wiseAtlasUrl, type SkyGrid, type WiseBand } from './wise-atlas-mosaic.mts';

const IBE_SEARCH = 'https://irsa.ipac.caltech.edu/ibe/search/wise/allwise/p3am_cdd';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

async function download(url: string, attempts = 8): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(900_000) }).catch((error: unknown) => error as Error);
    if (response instanceof Response && response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt >= attempts) throw new Error(`Download failed: ${response instanceof Response ? response.status : response.message} ${url}`);
    // IRSA answers bursts with 503; back off rather than hammering the archive.
    await new Promise(done => setTimeout(done, 20_000 * attempt));
  }
}

async function cached(path: string, url: string, check: (bytes: Buffer) => void): Promise<Buffer> {
  let bytes: Buffer | null = await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null) {
    bytes = await download(url); check(bytes);
    await mkdir(dirname(path), { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  } else check(bytes);
  return bytes;
}

/** Tiles whose published footprint reaches the grid, from the IBE search around the grid centre. */
export async function overlappingAtlasTiles(grid: SkyGrid, band: WiseBand) {
  const wcs = gridWcs(grid), toGrid = skyToGridPixel(wcs);
  const halfDiagonal = Math.hypot(grid.width, grid.height) / 2 * wcs.scaleDeg[1];
  // SIZE is the box side in degrees; an atlas tile half-diagonal is 1.11 degrees.
  const query = new URLSearchParams({ POS: `${grid.centerIcrsDegrees[0]},${grid.centerIcrsDegrees[1]}`, SIZE: String(2 * (halfDiagonal + 1.2)), INTERSECT: 'OVERLAPS', ct: 'csv' });
  const text = (await download(`${IBE_SEARCH}?${query}`)).toString('utf8'), [head, ...lines] = text.trim().split('\n');
  const columns = head!.split(','), column = (name: string) => { const i = columns.indexOf(name); if (i < 0) throw new Error(`IBE search lacks ${name}.`); return i; };
  const ids = new Set<string>();
  for (const line of lines) {
    const cells = line.split(','), cell = (name: string) => cells[column(name)]!;
    if (Number(cell('band')) !== WISE_ATLAS_BANDS[band].band) continue;
    const corners = [1, 2, 3, 4].map(i => [Number(cell(`ra${i}`)), Number(cell(`dec${i}`))] as const);
    const samples: (readonly [number, number])[] = [[Number(cell('crval1')), Number(cell('crval2'))]];
    corners.forEach((corner, i) => {
      const next = corners[(i + 1) % 4]!, dra = ((next[0] - corner[0] + 540) % 360) - 180;
      for (let k = 0; k < 32; k++) samples.push([(corner[0] + dra * k / 32 + 360) % 360, corner[1] + (next[1] - corner[1]) * k / 32]);
    });
    const pixels = samples.map(([ra, dec]) => toGrid(ra, dec)).filter((pixel): pixel is [number, number] => !!pixel);
    const xs = pixels.map(p => p[0]), ys = pixels.map(p => p[1]);
    if (pixels.length && Math.min(...xs) <= grid.width + 0.5 && Math.max(...xs) >= 0.5 && Math.min(...ys) <= grid.height + 0.5 && Math.max(...ys) >= 0.5) ids.add(cell('coadd_id'));
  }
  return [...ids].sort();
}

if (import.meta.main) {
  const [recipePath, ...options] = process.argv.slice(2);
  const cacheOption = options.find(option => option.startsWith('--cache='));
  if (!recipePath || options.some(option => option !== cacheOption)) throw new TypeError('Usage: author-sky-bands <recipe.json> [--cache=<directory>]');
  const cache = resolve(cacheOption?.slice(8) ?? '.local/nebula-lab/sky-bands'), root = process.cwd();
  const draft = requireRecord(JSON.parse(await readFile(recipePath, 'utf8')), 'Draft sky band composite');
  const grid = requireRecord(draft.grid) as unknown as SkyGrid;
  const bands = [];
  for (const raw of requireArray(draft.bands)) {
    const band = requireRecord(raw, 'Draft band'), id = requireString(band.band, 'Band'), route = SKY_BANDS[id];
    if (!route) throw new TypeError(`Unsupported band ${id}.`);
    if (route.acquisition.kind === 'hips2fits') {
      const url = skyBandUrl(grid, route.acquisition.hips);
      if (typeof band.sha256 === 'string') {
        await cached(resolve(cache, 'hips2fits', `${band.sha256}.fits`), url, bytes => { if (sha256(bytes) !== band.sha256 || bytes.length !== band.bytes) throw new Error(`Changed ${id} response: ${url}`); });
        bands.push({ band: id, sha256: band.sha256, bytes: band.bytes });
      } else {
        const bytes = await download(url), digest = sha256(bytes), path = resolve(cache, 'hips2fits', `${digest}.fits`);
        await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
        bands.push({ band: id, sha256: digest, bytes: bytes.length });
      }
      console.log(`SKY_BAND ${id} hips2fits pinned`);
      continue;
    }
    const wiseBand = route.acquisition.band, listPath = relative(root, resolve(dirname(recipePath), `${basename(recipePath, '.json')}-${wiseBand.toLowerCase()}-tiles.json`));
    const tiles = [];
    const coaddIds = await overlappingAtlasTiles(grid, wiseBand);
    for (const [index, coaddId] of coaddIds.entries()) {
      const url = wiseAtlasUrl(coaddId, wiseBand), path = resolve(cache, 'wise-atlas', basename(new URL(url).pathname));
      const bytes = await cached(path, url, data => gunzipSync(data));
      tiles.push({ coaddId, sha256: sha256(bytes), bytes: bytes.length });
      if ((index + 1) % 25 === 0 || index + 1 === coaddIds.length) console.log(`SKY_BAND ${id} tiles ${index + 1}/${coaddIds.length}`);
    }
    const list = Buffer.from(stable({ schema: 'cssearth-wise-atlas-tiles@1', band: wiseBand, tiles }));
    await writeFile(resolve(root, listPath), list);
    bands.push({ band: id, tiles: { path: listPath, sha256: sha256(list) } });
  }
  const recipe = { schema: draft.schema, grid: draft.grid, bands, backgroundPercentile: draft.backgroundPercentile, peakPercentile: draft.peakPercentile, display: draft.display };
  parseSkyBandComposite(recipe);
  await writeFile(recipePath, stable(recipe));
  console.log(`SKY_BANDS_AUTHORED ${recipePath}`);
}
