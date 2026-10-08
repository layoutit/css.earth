import {readJsonSource, fetchWithRetry, sourceCacheUrl, RUNTIME_ASSET_ORIGIN} from '@cssearth/bake/objects/sources';
import {parseMurColors, parseMurReceipt, murTileCount} from '@cssearth/bake/objects/layers/paged-ellipsoid';
import type {EnsoRecipe, MurReceipt, MurMosaic} from '@cssearth/bake/objects/layers/paged-ellipsoid';
import { readFile, readdir, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);
export const murLayer = 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies';
export const murCapabilitiesUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml';
export const murColormapUrl = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature_Anomalies.xml';
export const murProductUrl = 'https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1';
export const murDescriptionUrl = 'https://raw.githubusercontent.com/nasa-gibs/worldview/main/config/default/common/config/metadata/layers/multi-mission/ghrsst/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies.md';
/** One directory per analysis date under Earth's science sources: the tile archive (on the source mirror), the receipt
 * (tracked) and the mosaic built from the archive (ignored). */
export const murDateDirectory = (date: string) => `science/mur/${date}`;
export const murTileUrl = (date: string, row: number, col: number) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${murLayer}/default/${date}/1km/6/${row}/${col}.png`;

const json = (data: unknown) => JSON.stringify(data, null, 2) + '\n';
function demand(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(`MUR imagery: ${why}`); };
const day = (date: string) => new Date(`${date}T00:00:00Z`);

/** The layer's newest analysis and every published date up to today, from its WMTS time dimension. */
export function parseMurCapabilities(xml: string, today = new Date().toISOString().slice(0, 10)) {
  const layer = [...xml.matchAll(/<Layer>([\s\S]*?)<\/Layer>/g)].map(m => m[0])
    .find(text => text.includes(`<ows:Identifier>${murLayer}</ows:Identifier>`));
  demand(layer, 'anomaly layer missing');
  const date = layer.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/)?.[1];
  demand(date && date <= today, 'invalid or future latest date');
  demand(layer.includes('<TileMatrixSet>1km</TileMatrixSet>') && layer.includes(murColormapUrl), 'grid or colormap changed');
  const grid = [...xml.matchAll(/<TileMatrixSet>([\s\S]*?)<\/TileMatrixSet>/g)].map(m => m[0])
    .find(text => text.includes('<ows:Identifier>1km</ows:Identifier>'));
  const level = grid && [...grid.matchAll(/<TileMatrix>([\s\S]*?)<\/TileMatrix>/g)].map(m => m[0])
    .find(text => text.includes('<ows:Identifier>6</ows:Identifier>'));
  demand(level && ['<TopLeftCorner>-180 90</TopLeftCorner>', '<TileWidth>512</TileWidth>', '<TileHeight>512</TileHeight>',
    '<MatrixWidth>80</MatrixWidth>', '<MatrixHeight>40</MatrixHeight>'].every(value => level.includes(value)), 'native grid changed');
  // A gap in the record (a day NASA never processed) is a gap in the ranges, never a substituted neighbour.
  const dates: string[] = [];
  for (const [, first, last, period] of layer.matchAll(/<Value>(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\/(P\w+)<\/Value>/g)) {
    demand(period === 'P1D', `unexpected time period ${period}`);
    for (let at = day(first!); at <= day(last!); at.setUTCDate(at.getUTCDate() + 1)) dates.push(at.toISOString().slice(0, 10));
  }
  demand(dates.at(-1) === date, 'the newest published range does not end on the default date');
  return { date, dates: dates.filter(value => value <= today), layerXml: layer, gridXml: grid };
}

/** The newest published analysis and the days `spacingDays` apart before it, `count` steps in all, oldest first.
 * A step NASA never published is left out, never replaced by a neighbouring day. */
export function murWindow(dates: readonly string[], { count, spacingDays }: { count: number; spacingDays: number }) {
  demand(Number.isInteger(count) && count > 1 && Number.isInteger(spacingDays) && spacingDays > 0, 'invalid window');
  const published = new Set(dates), newest = [...dates].sort().at(-1);
  demand(newest, 'no published dates');
  const steps = Array.from({ length: count }, (_, step) => {
    const at = day(newest); at.setUTCDate(at.getUTCDate() - step * spacingDays);
    return at.toISOString().slice(0, 10);
  }).filter(date => published.has(date)).reverse();
  demand(steps.length > 1, 'too few published dates for the window');
  return steps;
}

export function verifyMurTile(actualTime: string | null, actualLayer: string | null, date: string, empty = false) {
  if (empty && actualTime === null && actualLayer === null) return;
  demand(actualTime === `${date}T00:00:00Z`, `tile substituted another date: ${actualTime}`);
  demand(actualLayer === `${murLayer}_v4.1_STD`, `unexpected analysis: ${actualLayer}`);
}

// Pixel-center nearest sampling preserves NASA's published 0.1-degree-C bins.
// No attempt is made to reconstruct a continuous scalar from colored imagery.
export async function prepareMurMosaic(directory: string, receipt: Pick<MurReceipt, 'tiles' | 'grid'>, outputPath: string, width = 16384): Promise<MurMosaic> {
  demand([8192, 16384].includes(width), 'unsupported preparation width');
  demand(receipt.tiles.bytes.length === murTileCount && receipt.grid.level === 6, 'incomplete global imagery');
  const data = Buffer.alloc(width * width / 2 * 3), height = width / 2;
  const scale = width / 40960, gray = [62, 68, 73], empty = new Set(receipt.tiles.empty);
  let covered = 0, missing = 0;
  for (let index = 0; index < murTileCount; index++) {
    const row = Math.floor(index / 80), col = index % 80;
    const bytes = await readFile(join(directory, `${row}-${col}.png`));
    demand(bytes.length === receipt.tiles.bytes[index], `tile size differs: ${row}/${col}`);
    const { data: pixels, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    demand(info.width === 512 && info.height === 512 && info.channels === 4, 'tile dimensions changed');
    if (empty.has(index)) demand(pixels.every((v, i) => i % 4 !== 3 || v === 0), 'empty tile contains observations');
    const x0 = Math.max(0, Math.ceil(col * 512 * scale - .5));
    const x1 = Math.min(width, Math.ceil((col + 1) * 512 * scale - .5));
    const y0 = Math.max(0, Math.ceil(row * 512 * scale - .5));
    const y1 = Math.min(height, Math.ceil((row + 1) * 512 * scale - .5));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const sx = Math.floor((x + .5) / scale) - col * 512;
      const sy = Math.floor((y + .5) / scale) - row * 512;
      const si = (sy * 512 + sx) * 4, di = (y * width + x) * 3;
      demand(pixels[si + 3] === 0 || pixels[si + 3] === 255, 'unexpected fractional source coverage');
      const valid = pixels[si + 3] === 255;
      if (valid) covered++; else missing++;
      for (let c = 0; c < 3; c++) data[di + c] = valid ? pixels[si + c]! : gray[c]!;
    }
  }
  demand(covered + missing === width * height, 'mosaic coverage incomplete');
  await sharp(data, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(outputPath);
  return { width, height, sourceWidth: 40960, sourceHeight: 20480, sampling: 'nearest pixel centers', covered, missing };
}

/** The layer description, grid and color table every date shares, written beside the dated directories. */
export async function acquireMurShared(scienceDirectory: string, capabilities: Buffer) {
  const fetchBytes = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    demand(response.ok, `HTTP ${response.status}: ${url}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const { layerXml, gridXml } = parseMurCapabilities(capabilities.toString());
  const colormap = await fetchBytes(murColormapUrl); parseMurColors(colormap.toString());
  await mkdir(scienceDirectory, { recursive: true });
  await writeFile(join(scienceDirectory, 'mur-gibs-layer.xml'), layerXml + '\n' + gridXml + '\n');
  await writeFile(join(scienceDirectory, 'mur-gibs-colormap.xml'), colormap);
  await writeFile(join(scienceDirectory, 'mur-gibs-description.md'), await fetchBytes(murDescriptionUrl));
}

/** Every native 1 km tile of one analysis date. A tile with observations must attest that date and the v4.1 analysis in its
 * response headers; one without them is accepted only when its alpha shows no observations. The archive, mosaic and
 * receipt are written only after every tile is verified: a partial date is never published. */
export async function acquireMurDate(directory: string, date: string) {
  const tileDirectory = await mkdtemp(join(tmpdir(), `earth-mur-${date}-`));
  try {
    const bytes = new Array<number>(murTileCount), empty: number[] = [];
    let cursor = 0, totalBytes = 0, completed = 0;
    const getTile = async (index: number) => {
      const row = Math.floor(index / 80), col = index % 80, url = murTileUrl(date, row, col);
      let failure: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
          demand(response.ok && response.headers.get('content-type')?.includes('image/png'), `invalid tile response ${response.status}`);
          const actualTime = response.headers.get('layer-time-actual'), actualLayer = response.headers.get('layer-identifier-actual');
          const tile = Buffer.from(await response.arrayBuffer());
          demand(tile.length > 0 && tile.length < 2_000_000, 'unexpected tile size');
          const info = await sharp(tile).metadata(); demand(info.width === 512 && info.height === 512, 'unexpected tile shape');
          let blank = false;
          if (actualTime === null || actualLayer === null) {
            const pixels = await sharp(tile).ensureAlpha().raw().toBuffer();
            blank = pixels.every((v, i) => i % 4 !== 3 || v === 0);
          }
          verifyMurTile(actualTime, actualLayer, date, blank);
          totalBytes += tile.length; demand(totalBytes < 250_000_000, 'source transfer exceeds 250 MB bound');
          await writeFile(join(tileDirectory, `${row}-${col}.png`), tile);
          bytes[index] = tile.length; if (blank) empty.push(index);
          completed++; if (completed % 800 === 0) console.log(json({ date, downloaded: completed, of: murTileCount, bytes: totalBytes }).trim());
          return;
        } catch (error) { failure = error; }
      }
      throw failure;
    };
    await Promise.all(Array.from({ length: 12 }, async () => { while (cursor < murTileCount) await getTile(cursor++); }));
    demand(bytes.every(Number.isInteger), 'partial download cannot be published');
    empty.sort((a, b) => a - b);
    const grid = { crs: 'CRS84', level: 6, columns: 80, rows: 40, tileSize: 512, west: -180, north: 90, cellDegrees: 360 / 40960 };
    await mkdir(directory, { recursive: true });
    const mosaic = await prepareMurMosaic(tileDirectory, { tiles: { bytes, empty }, grid }, join(directory, 'mosaic.png'));
    await run('tar', ['-czf', join(directory, 'tiles.tar.gz'), '-C', tileDirectory, '.'], { maxBuffer: 1024 * 1024 });
    const receipt = { schema: 'cssearth-mur-gibs@2', checked: new Date().toISOString(), date, product: 'NASA MUR v4.1 via GIBS',
      baseline: '2003–2014', layer: murLayer, grid, sourceBytes: totalBytes,
      archiveBytes: (await stat(join(directory, 'tiles.tar.gz'))).size, mosaic, tiles: { bytes, empty } };
    await writeFile(join(directory, 'receipt.json'), json(receipt));
    return parseMurReceipt(receipt);
  } finally { await rm(tileDirectory, { recursive: true, force: true }); }
}

/** Rebuild one date's mosaic from its archive, fetching a missing archive (and, when `receipt` is true, its receipt) from
 * the source mirror. Returns false when the mirror does not hold the date. */
export async function restoreMurDate(directory: string, date: string, { mirror = RUNTIME_ASSET_ORIGIN, receipt: fetchReceipt = false } = {}) {
  const fromMirror = async (name: string) => {
    // The query keeps a miss (a date no build has published yet) from caching a 404 at the edge for the key the same
    // build is about to publish.
    const response = await fetch(`${sourceCacheUrl(mirror, 'earth', `${murDateDirectory(date)}/${name}`)}?v=${Date.now()}`, { signal: AbortSignal.timeout(120000) });
    if (response.status === 404) return null;
    demand(response.ok, `${date}: source mirror HTTP ${response.status} for ${name}`);
    return Buffer.from(await response.arrayBuffer());
  };
  await mkdir(directory, { recursive: true });
  const receiptPath = join(directory, 'receipt.json'), archive = join(directory, 'tiles.tar.gz');
  if (fetchReceipt && !await stat(receiptPath).then(() => true, () => false)) {
    const bytes = await fromMirror('receipt.json');
    if (!bytes) return false;
    parseMurReceipt(JSON.parse(bytes.toString('utf8')));
    await writeFile(receiptPath, bytes);
  }
  const receipt = parseMurReceipt(await readJsonSource(receiptPath));
  if (!await stat(archive).then(() => true, () => false)) {
    const bytes = await fromMirror('tiles.tar.gz');
    if (!bytes) return false;
    await writeFile(archive, bytes);
  }
  demand((await stat(archive)).size === receipt.archiveBytes, `${date}: archive size differs`);
  if (await stat(join(directory, 'mosaic.png')).then(() => true, () => false)) return true;
  const temp = await mkdtemp(join(tmpdir(), 'earth-mur-restore-'));
  try {
    const { stdout } = await run('tar', ['-tzf', archive]);
    demand(stdout.trim().split('\n').every(name => name === './' || /^\.\/\d{1,2}-\d{1,2}\.png$/.test(name)), 'unexpected archive entry');
    await run('tar', ['-xzf', archive, '-C', temp]);
    const output = join(temp, 'mosaic.png');
    const mosaic = await prepareMurMosaic(temp, receipt, output, receipt.mosaic.width);
    demand(mosaic.covered === receipt.mosaic.covered && mosaic.missing === receipt.mosaic.missing, `${date}: restored mosaic differs`);
    await writeFile(join(directory, 'mosaic.png'), await readFile(output), { flag: 'wx' });
    return true;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

/** Rebuild each dated mosaic that is missing, from its archive, fetching a missing archive from the source mirror. */
export async function restoreMurMosaics(scienceDirectory: string, mirror = RUNTIME_ASSET_ORIGIN) {
  const root = join(scienceDirectory, 'mur'), restored: string[] = [];
  for (const date of (await readdir(root).catch(() => [])).filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort()) {
    const directory = join(root, date);
    if (await stat(join(directory, 'mosaic.png')).then(() => true, () => false)) continue;
    if (!await restoreMurDate(directory, date, { mirror })) throw new Error(`MUR imagery: ${date}: the source mirror has no tile archive; run node packages/bake/authoring/earth/refresh-earth-enso.mts.`);
    restored.push(date);
  }
  return restored;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory, mirror] = process.argv.slice(2);
  if (mode !== 'restore' || !directory) throw new TypeError('Usage: mur-imagery.mts restore <Earth science directory> [<source mirror origin>]');
  console.log(json({ restored: await restoreMurMosaics(resolve(directory), mirror) }));
}

const formatDate = (date: string, month: 'short' | 'long', year = true) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month, ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
export const murDatasetId = (date: string) => `enso-${date}`;

/** One date of the ENSO sequence; its reader text is murEnsoText's and its notes restate the product and date. */
export function murEnsoContent(recipe: EnsoRecipe) {
  return { id: murDatasetId(recipe.date), label: 'ENSO',
    step: { group: 'enso', label: formatDate(recipe.date, 'short', false), opens: 'last' },
    thumbnail: `/scenes/earth/earth-dataset-enso-${recipe.date}.webp`, falseColor: true,
    source: { id: `nasa-mur-gibs-tiles-${recipe.date}`, url: murProductUrl },
    facts: [{ id: 'enso-status', label: 'NOAA status', value: recipe.advisory.status },
      { id: 'enso-advisory-date', label: 'Advisory issued', value: recipe.advisory.date },
      { id: 'enso-checked', label: 'Source checked', value: recipe.checked.slice(0, 10) }],
    legend: { kind: 'scale', title: 'Temperature anomaly · °C', sourceUrl: murColormapUrl,
      image: 'earth-enso-legend.png', width: 620, height: 16, labels: ['< −3', '0', '≥ +3'] },
    legendNote: 'NASA imagery uses 0.1 °C color bins; the NOAA advisory describes the coupled ocean–atmosphere state.',
    notes: `NASA MUR · 1 km source imagery · ${formatDate(recipe.date, 'short')}. Sea-surface temperature departure from the ${recipe.baseline} average. NASA colors saturate below −3 and at +3 °C. Gray: land, ice, or unavailable imagery.` };
}

/** Earth's text.json entry for one date of the ENSO sequence. */
export function murEnsoText(recipe: EnsoRecipe) {
  return { title: 'Sea-surface temperature anomaly', detail: formatDate(recipe.date, 'short'),
    summary: `Sea-surface temperature compared with the ${recipe.baseline} average, on ${formatDate(recipe.date, 'long')}. Gray covers land, ice and gaps.` };
}
