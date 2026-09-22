import { sha256 } from '../../../src/platform/sha256.mts';
import {readJsonSource, requireString} from '../../sources/source-values.mts';
import {parseMurReceipt} from './source-contract.mts';
import type {EnsoRecipe, MurInventory, MurMosaic, MurTile} from './contracts.mts';
interface AcquiredMurInventory extends MurInventory {
  schema: string; checked: string; product: string; baseline: string; layer: string;
  grid: {crs: string; level: number; columns: number; rows: number; tileSize: number; west: number; north: number; cellDegrees: number};
  sourceBytes: number; capabilitiesSha256: string; mosaic?: MurMosaic; archiveSha256?: string; archiveBytes?: number;
}
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
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

const json = (data: unknown) => JSON.stringify(data, null, 2) + '\n';
function demand(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(`MUR imagery: ${why}`); };

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
  return { date, layerXml: layer, gridXml: grid };
}

export function parseMurColors(xml: string) {
  const entries = [...xml.matchAll(/<ColorMapEntry\s+([^>]+)\/>/g)].map(match => {
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    return { rgb: requireString(attrs.rgb, "MUR RGB color").split(',').map(Number), nodata: attrs.nodata === 'true', transparent: attrs.transparent === 'true', range: attrs.value };
  });
  const valid = entries.filter(e => !e.nodata);
  demand(entries.length === 63 && valid.length === 62 && entries[0].transparent, 'color table changed');
  demand(valid[0].range === '[-INF,-3.0)' && valid[valid.length - 1].range === '[3.0,+INF)', 'saturation endpoints changed');
  const bins = valid.slice(1, -1);
  demand(bins.every((e, i) => e.range === `[${(-3 + i / 10).toFixed(1)},${(-3 + (i + 1) / 10).toFixed(1)})`), 'anomaly bins changed');
  return { entries, bins, under: valid[0], over: valid[valid.length - 1] };
}

export function verifyMurTile(actualTime: string | null, actualLayer: string | null, date: string, empty = false) {
  if (empty && actualTime === null && actualLayer === null) return;
  demand(actualTime === `${date}T00:00:00Z`, `tile substituted another date: ${actualTime}`);
  demand(actualLayer === `${murLayer}_v4.1_STD`, `unexpected analysis: ${actualLayer}`);
}

// Pixel-center nearest sampling preserves NASA's published 0.1-degree-C bins.
// No attempt is made to reconstruct a continuous scalar from colored imagery.
export async function prepareMurMosaic(directory: string, receipt: MurInventory, outputPath: string, width = 16384): Promise<MurMosaic> {
  demand([8192, 16384].includes(width), 'unsupported preparation width');
  demand(receipt.tiles.length === 3200 && receipt.complete && receipt.grid.level === 6, 'incomplete global imagery');
  const data = Buffer.alloc(width * width / 2 * 3), height = width / 2;
  const scale = width / 40960, gray = [62, 68, 73];
  let covered = 0, missing = 0;
  const seen = new Set<string>();
  for (const tile of receipt.tiles) {
    const key = `${tile.row}/${tile.col}`;
    demand(!seen.has(key) && Number.isInteger(tile.row) && Number.isInteger(tile.col) && tile.row >= 0 && tile.row < 40 && tile.col >= 0 && tile.col < 80, 'duplicate or invalid tile'); seen.add(key);
    verifyMurTile(tile.actualTime, tile.actualLayer, receipt.date, tile.empty);
    const bytes = await readFile(join(directory, `${tile.row}-${tile.col}.png`));
    demand(sha256(bytes) === tile.sha256 && bytes.length === tile.bytes, `tile hash differs: ${key}`);
    const { data: pixels, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    demand(info.width === 512 && info.height === 512 && info.channels === 4, 'tile dimensions changed');
    if (tile.empty) demand(pixels.every((v, i) => i % 4 !== 3 || v === 0), 'empty tile contains observations');
    const x0 = Math.max(0, Math.ceil(tile.col * 512 * scale - .5));
    const x1 = Math.min(width, Math.ceil((tile.col + 1) * 512 * scale - .5));
    const y0 = Math.max(0, Math.ceil(tile.row * 512 * scale - .5));
    const y1 = Math.min(height, Math.ceil((tile.row + 1) * 512 * scale - .5));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const sx = Math.floor((x + .5) / scale) - tile.col * 512;
      const sy = Math.floor((y + .5) / scale) - tile.row * 512;
      const si = (sy * 512 + sx) * 4, di = (y * width + x) * 3;
      demand(pixels[si + 3] === 0 || pixels[si + 3] === 255, 'unexpected fractional source coverage');
      const valid = pixels[si + 3] === 255;
      if (valid) covered++; else missing++;
      for (let c = 0; c < 3; c++) data[di + c] = valid ? pixels[si + c] : gray[c];
    }
  }
  demand(covered + missing === width * height, 'mosaic coverage incomplete');
  await sharp(data, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(outputPath);
  return { width, height, sourceWidth: 40960, sourceHeight: 20480, sampling: 'nearest pixel centers', covered, missing, sha256: sha256(await readFile(outputPath)) };
}

export async function acquireMurImagery(directory: string, { capabilitiesPath }: {capabilitiesPath?: string} = {}) {
  await mkdir(directory, { recursive: true });
  const fetchBytes = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    demand(response.ok, `HTTP ${response.status}: ${url}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const capabilities = capabilitiesPath ? await readFile(capabilitiesPath) : await fetchBytes(murCapabilitiesUrl);
  const { date, layerXml, gridXml } = parseMurCapabilities(capabilities.toString());
  const colormap = await fetchBytes(murColormapUrl); parseMurColors(colormap.toString());
  const description = await fetchBytes(murDescriptionUrl);
  await writeFile(join(directory, 'mur-gibs-layer.xml'), layerXml + '\n' + gridXml + '\n');
  await writeFile(join(directory, 'mur-gibs-colormap.xml'), colormap);
  await writeFile(join(directory, 'mur-gibs-description.md'), description);
  const tileDirectory = join(directory, 'tiles'); await mkdir(tileDirectory, { recursive: true });
  const records = new Array<MurTile>(3200); let cursor = 0, totalBytes = 0, completed = 0;
  const getTile = async (index: number) => {
    const row = Math.floor(index / 80), col = index % 80;
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${murLayer}/default/${date}/1km/6/${row}/${col}.png`;
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
        demand(response.ok && response.headers.get('content-type')?.includes('image/png'), `invalid tile response ${response.status}`);
        const actualTime = response.headers.get('layer-time-actual'), actualLayer = response.headers.get('layer-identifier-actual');
        const bytes = Buffer.from(await response.arrayBuffer());
        demand(bytes.length > 0 && bytes.length < 2_000_000, 'unexpected tile size');
        const info = await sharp(bytes).metadata(); demand(info.width === 512 && info.height === 512, 'unexpected tile shape');
        let empty = false;
        if (actualTime === null || actualLayer === null) {
          const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
          empty = pixels.every((v, i) => i % 4 !== 3 || v === 0);
        }
        verifyMurTile(actualTime, actualLayer, date, empty);
        totalBytes += bytes.length; demand(totalBytes < 250_000_000, 'source transfer exceeds 250 MB bound');
        await writeFile(join(tileDirectory, `${row}-${col}.png`), bytes);
        records[index] = { row, col, url, actualTime, actualLayer, empty, bytes: bytes.length, sha256: sha256(bytes) };
        completed++; if (completed % 200 === 0) console.log(json({ downloaded: completed, of: 3200, bytes: totalBytes }).trim());
        return;
      } catch (error) { failure = error; }
    }
    throw failure;
  };
  await Promise.all(Array.from({ length: 8 }, async () => { while (cursor < 3200) await getTile(cursor++); }));
  const receipt: AcquiredMurInventory = { schema: 'cssearth-mur-gibs@1', checked: new Date().toISOString(), date, product: 'NASA MUR v4.1 via GIBS', baseline: '2003–2014', layer: murLayer,
    grid: { crs: 'CRS84', level: 6, columns: 80, rows: 40, tileSize: 512, west: -180, north: 90, cellDegrees: 360 / 40960 },
    sourceBytes: totalBytes, complete: records.every(Boolean), capabilitiesSha256: sha256(capabilities), tiles: records };
  demand(receipt.complete, 'partial download cannot be published');
  receipt.mosaic = await prepareMurMosaic(tileDirectory, receipt, join(directory, 'mur-gibs.png'));
  await run('tar', ['-czf', join(directory, 'mur-gibs-tiles.tar.gz'), '-C', tileDirectory, '.'], { maxBuffer: 1024 * 1024 });
  receipt.archiveSha256 = sha256(await readFile(join(directory, 'mur-gibs-tiles.tar.gz')));
  receipt.archiveBytes = (await stat(join(directory, 'mur-gibs-tiles.tar.gz'))).size;
  await writeFile(join(directory, 'mur-gibs-receipt.json'), json(receipt));
  return parseMurReceipt(receipt);
}

export async function restoreMurMosaic(sourceDirectory: string) {
  const receipt = parseMurReceipt(await readJsonSource(join(sourceDirectory, 'mur-gibs-receipt.json')));
  const archive = join(sourceDirectory, 'mur-gibs-tiles.tar.gz');
  demand(sha256(await readFile(archive)) === receipt.archiveSha256, 'archive hash differs');
  const temp = await mkdtemp(join(tmpdir(), 'earth-mur-restore-'));
  try {
    const { stdout } = await run('tar', ['-tzf', archive]);
    demand(stdout.trim().split('\n').every(name => name === './' || /^\.\/\d{1,2}-\d{1,2}\.png$/.test(name)), 'unexpected archive entry');
    await run('tar', ['-xzf', archive, '-C', temp]);
    const output = join(temp, 'mosaic.png');
    const mosaic = await prepareMurMosaic(temp, receipt, output, receipt.mosaic.width);
    demand(mosaic.sha256 === receipt.mosaic.sha256, 'restored mosaic differs');
    await writeFile(join(sourceDirectory, 'mur-gibs.png'), await readFile(output), { flag: 'wx' });
    return mosaic;
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory, capabilitiesPath] = process.argv.slice(2);
  if (!directory) throw new TypeError('MUR imagery requires an output directory.');
  if (mode === 'restore') {
    const result = await restoreMurMosaic(resolve(directory));
    console.log(json({mosaic: result}));
  } else {
    const result = await acquireMurImagery(resolve(directory), {capabilitiesPath});
    console.log(json({date: result.date, complete: result.complete, sourceBytes: result.sourceBytes, archiveBytes: result.archiveBytes, mosaic: result.mosaic}));
  }
}

/** The dated ENSO lens recipe; its reader text is murEnsoText's and its notes restate the product and date. */
export function murEnsoContent(recipe: EnsoRecipe) {
  const date = new Date(`${recipe.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { id: 'enso', label: 'ENSO',
    thumbnail: '/scenes/earth/earth-lens-enso.webp', falseColor: true,
    source: { id: 'nasa-mur-gibs-tiles', url: murProductUrl },
    facts: [{ id: 'enso-status', label: 'NOAA status', value: recipe.advisory.status },
      { id: 'enso-advisory-date', label: 'Advisory issued', value: recipe.advisory.date },
      { id: 'enso-checked', label: 'Source checked', value: recipe.checked.slice(0, 10) }],
    legend: { kind: 'scale', title: 'Temperature anomaly · °C', sourceUrl: murColormapUrl,
      image: 'earth-enso-legend.png', width: 620, height: 16, labels: ['< −3', '0', '≥ +3'] },
    legendNote: 'NASA imagery uses 0.1 °C color bins; the NOAA advisory describes the coupled ocean–atmosphere state.',
    notes: `NASA MUR · 1 km source imagery · ${date}. Sea-surface temperature departure from the ${recipe.baseline} average. NASA colors saturate below −3 and at +3 °C. Gray: land, ice, or unavailable imagery.` };
}

/** Earth's text.json entry for the ENSO dataset on the recipe's date. */
export function murEnsoText(recipe: EnsoRecipe) {
  const day = (month: 'short' | 'long') => new Date(`${recipe.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
  return { title: 'Sea-surface temperature anomaly', detail: day('short'),
    summary: `Sea-surface temperature compared with the ${recipe.baseline} average, on ${day('long')}. Gray covers land, ice and gaps.` };
}

export async function verifyPreparedMurImage(sourceDirectory: string, recipe: Pick<EnsoRecipe, "date" | "baseline">) {
  const receipt = parseMurReceipt(await readJsonSource(join(sourceDirectory, 'science/mur-gibs-receipt.json')));
  demand(recipe.date === receipt.date && recipe.baseline === '2003–2014' && receipt.baseline === recipe.baseline, 'date or baseline differs');
  demand(receipt.complete && receipt.tiles.length === 3200 && receipt.grid.level === 6, 'incomplete source grid');
  const input = await readFile(join(sourceDirectory, 'science/mur-gibs.png'));
  demand(sha256(input) === receipt.mosaic.sha256, 'prepared source hash differs');
  const info = await sharp(input).metadata();
  demand(info.width === 16384 && info.height === 8192, 'prepared source dimensions changed');
  return input;
}

export async function writeMurLegend(sourceDirectory: string, outputPath: string) {
  const { entries } = parseMurColors(await readFile(join(sourceDirectory, 'science/mur-gibs-colormap.xml'), 'utf8'));
  const colors = entries.filter(e => !e.nodata), width = colors.length * 10, height = 16;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(colors[Math.floor(x / 10)].rgb, (y * width + x) * 3);
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(outputPath);
}
