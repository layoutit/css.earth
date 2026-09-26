import { sha256 } from '@cssearth/core/node';
import type { SurfaceBankPlan, SurfaceBankLenses } from './contracts.mts';
/** `maximumWidth`: the largest level the runtime may choose. Wider levels are still prepared (smaller levels are reduced
 * from the canonical page) but never offered, so no view downloads them. */
export interface TextureLevelConfiguration {widths:readonly number[];fixedWidth?:number;maximumWidth?:number;hysteresis:number;texelsPerCssPixel:number}
interface TextureLevelAsset {url:string;decodedBytes:number}
interface TextureLevelReceipt {source:string;sourceSha256:string;url:string;sha256:string;width:number;height:number;bottomPadding:number}
import sharp from 'sharp';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { requireSurfacePages, surfaceBankInventory } from './surface-banks.mts';
import { encodeLossyWebp } from '@cssearth/bake/raster';

/** Whether a WebP file is lossless: its image data is a VP8L chunk. */
function losslessWebp(bytes: Buffer): boolean {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new TypeError('A texture level source is not WebP.');
  for (let offset = 12; offset + 8 <= bytes.length; offset += 8 + bytes.readUInt32LE(offset + 4) + (bytes.readUInt32LE(offset + 4) & 1)) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    if (chunk === 'VP8L') return true;
    if (chunk === 'VP8 ') return false;
  }
  throw new TypeError('A texture level source has no WebP image data.');
}

export interface TextureLevelBank {id: string; urls: readonly string[]}

/** A level whose sheet stays within this side draws every page of a bank from one square sheet: the first view then
 * loads one image per bank instead of one per page (Earth: 112 square pages; about 70 requests at the full globe). */
const SHEET_MAXIMUM_SIDE = 4096;
/** Every level scales a page by a power of two down to 1/16, so sheet positions stay whole pixels at every level. */
const SHEET_STEP = 16;

/** Shelf-pack square pages, largest first, into the smallest square sheet (sides and positions in canonical pixels). */
export function packTextureSheet(sides: readonly number[]): { side: number; positions: { x: number; y: number }[] } {
  if (!sides.length || sides.some(side => !Number.isInteger(side) || side <= 0 || side % SHEET_STEP)) throw new TypeError(`Texture sheet pages must be positive multiples of ${SHEET_STEP}: ${sides.join(', ')}.`);
  const order = sides.map((side, index) => ({ side, index })).sort((a, b) => b.side - a.side || a.index - b.index);
  const place = (width: number) => {
    const positions: { x: number; y: number }[] = [];
    let x = 0, y = 0, shelf = 0;
    for (const { side, index } of order) {
      if (x + side > width) { x = 0; y += shelf; shelf = 0; }
      positions[index] = { x, y }; x += side; shelf = Math.max(shelf, side);
    }
    return y + shelf <= width ? positions : null;
  };
  let side = Math.ceil(Math.sqrt(sides.reduce((sum, value) => sum + value * value, 0)) / SHEET_STEP) * SHEET_STEP;
  for (;; side += SHEET_STEP) { const positions = place(side); if (positions) return { side, positions }; }
}


/** Downsample the canonical prepared atlas offline. Padding before reduction
 * keeps both axes at exactly the same scale; CSS atlas addresses never change. */
export async function prepareTextureLevels({ config, plan, lenses, publicDirectory, banks: selectedBanks }: {config: {textureLevels?:TextureLevelConfiguration;atlas:{pageSize:number;density:number};camera:{logicalBodyDiameter:number};publicBase:string;surface?:{maps:readonly {name:string;maximumTextureWidth?:number}[]}};plan?:SurfaceBankPlan;lenses?:SurfaceBankLenses;publicDirectory:string;banks?:readonly TextureLevelBank[]}) {
  if (!config.textureLevels) return null;
  const { widths, fixedWidth, maximumWidth, hysteresis, texelsPerCssPixel } = config.textureLevels;
  const canonicalWidth = config.atlas.pageSize;
  if (!Array.isArray(widths) || widths.at(-1) !== canonicalWidth || widths.some((width, i) =>
    !Number.isInteger(width) || width < 1 || canonicalWidth % width || i > 0 && width <= widths[i - 1]) ||
    (fixedWidth !== undefined && !widths.includes(fixedWidth)) ||
    (maximumWidth !== undefined && (!widths.includes(maximumWidth) || (fixedWidth !== undefined && fixedWidth > maximumWidth))) ||
    !(hysteresis >= 0 && hysteresis < 1) || !(texelsPerCssPixel >= 1)) throw new TypeError('Invalid prepared atlas levels.');
  const banks = selectedBanks
    ? selectedBanks.map(bank=>({id:bank.id,urls:requireSurfacePages(bank.urls,`Texture level ${bank.id}`,config.publicBase)}))
    : plan&&lenses ? surfaceBankInventory(plan,lenses,config.publicBase) : (()=>{throw new TypeError('Texture levels require prepared surface banks.');})();
  if(!banks.length||new Set(banks.map(bank=>bank.id)).size!==banks.length)throw new TypeError('Texture level banks must be distinct.');
  type Level = {minimumDiameter:number;resources:Record<string,string>;tiles?:Record<string,{x:number;y:number;scale:number}>};
  const entries: (TextureLevelAsset & {key:string;pool:string})[] = [], receipts: TextureLevelReceipt[] = [], levels: Level[] = widths.map((width, i) => ({
    // The canonical atlas density is relative to the authored logical globe.
    minimumDiameter: i ? config.camera.logicalBodyDiameter * config.atlas.density *
      widths[i - 1] / canonicalWidth / texelsPerCssPixel : 0,
    resources: {} as Record<string,string>,
  }));
  const urls = new Map<string, TextureLevelAsset[]>();
  const pageDimensions = new Map<string, { width: number; height: number; lossless: boolean }>();
  await mkdir(publicDirectory, { recursive: true });
  const prepare = async (key: string, url: string, pool: string) => {
    let prepared = urls.get(url);
    if (!prepared) {
      const source = await readFile(resolve(publicDirectory, url.slice(config.publicBase.length)));
      const { width, height } = await sharp(source).metadata();
      if (width && height) pageDimensions.set(url, { width, height, lossless: losslessWebp(source) });
      // Any page width works when every level scales it to whole pixels (checked per level below); square pages are not
      // halvings of the canonical width.
      if (!width || !height) throw new TypeError(`Atlas dimensions differ: ${url}`);
      prepared = [];
      for (const levelWidth of widths) {
        const targetWidth = width * levelWidth / canonicalWidth;
        if (!Number.isInteger(targetWidth)) throw new TypeError(`Atlas level dimensions differ: ${url}`);
        const divisor = width / targetWidth, padding = (divisor - height % divisor) % divisor;
        const targetUrl = targetWidth === width ? url : `${config.publicBase}${basename(url, '.webp')}-level-${targetWidth}.webp`;
        let output: Buffer = source, outputHeight = height;
        if (targetWidth !== width) {
          // Raw intermediate forces extension to happen before resize in sharp.
          const padded = await sharp(source).ensureAlpha().extend({ bottom: padding, background: '#00000000' }).raw().toBuffer({ resolveWithObject: true });
          outputHeight = (height + padding) / divisor;
          // A level is encoded the way its page is: a lossless page's levels stay lossless, a lossy page's go through
          // the lossy lane (lossy-lane.ts), so a smaller level never costs more per texel than the full page.
          const reduced = sharp(padded.data, { raw: padded.info }).resize(targetWidth, outputHeight, { kernel: 'lanczos3' });
          output = losslessWebp(source) ? await reduced.webp({ lossless: true, effort: 4 }).toBuffer() : await encodeLossyWebp(reduced, { alphaQuality: 100, effort: 4 });
          await writeFile(resolve(publicDirectory, targetUrl.slice(config.publicBase.length)), output);
        }
        prepared.push({ url: targetUrl, decodedBytes: targetWidth * outputHeight * 4 });
        receipts.push({ source: url, sourceSha256: sha256(source), url: targetUrl, sha256: sha256(output), width: targetWidth, height: outputHeight, bottomPadding: padding });
      }
      urls.set(url, prepared);
    }
    for (const [i, asset] of prepared.entries()) {
      const resource = i === widths.length - 1 ? key : `${key}:level:${widths[i]}`;
      levels[i].resources[key] = resource;
      entries.push({ key: resource, ...asset, pool });
    }
  };
  for (const bank of banks) for (const [page, url] of bank.urls.entries()) await prepare(`page:${bank.id}:${page}`, url, 'pages');
  // Small levels: each bank's pages become tiles of one square sheet, which every page's resource then names.
  const sheets: { url: string; sha256: string; side: number; pages: { source: string; x: number; y: number }[] }[] = [];
  const sheetUrls = new Map<string, { key: string; url: string; tiles: { x: number; y: number; scale: number }[] }>();
  const replaced = new Set<string>();
  for (const bank of banks) {
    const dimensions = bank.urls.map(url => pageDimensions.get(url)!);
    if (dimensions.some(page => page.width !== page.height)) continue;
    const packed = packTextureSheet(dimensions.map(page => page.width));
    for (const [i, levelWidth] of widths.entries()) {
      const side = packed.side * levelWidth / canonicalWidth;
      if (i === widths.length - 1 || side > SHEET_MAXIMUM_SIDE) continue;
      const cacheKey = `${levelWidth}:${bank.urls.join(',')}`;
      let sheet = sheetUrls.get(cacheKey);
      if (!sheet) {
        const url = `${config.publicBase}${basename(bank.urls[0]!, '.webp')}-sheet-${levelWidth}.webp`, scale = levelWidth / canonicalWidth;
        const parts = await Promise.all(bank.urls.map(async (page, p) => {
          replaced.add(urls.get(page)![i]!.url);
          // From the full page, reduced once and kept lossless until the sheet is encoded: its own lossy level would be
          // encoded twice.
          const full = await readFile(resolve(publicDirectory, page.slice(config.publicBase.length)));
          const input = await sharp(full).ensureAlpha().resize(dimensions[p]!.width * scale, dimensions[p]!.height * scale, { kernel: 'lanczos3' }).png().toBuffer();
          return { input, left: packed.positions[p]!.x * scale, top: packed.positions[p]!.y * scale };
        }));
        const canvas = sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(parts);
        const output = dimensions[0]!.lossless ? await canvas.webp({ lossless: true, effort: 4 }).toBuffer() : await encodeLossyWebp(sharp(await canvas.png().toBuffer()), { alphaQuality: 100, effort: 4 });
        await writeFile(resolve(publicDirectory, url.slice(config.publicBase.length)), output);
        sheets.push({ url, sha256: sha256(output), side, pages: bank.urls.map((source, p) => ({ source, ...packed.positions[p]! })) });
        const key = `sheet:${bank.id}:level:${levelWidth}`;
        entries.push({ key, url, decodedBytes: side * side * 4, pool: 'pages' });
        sheet = { key, url, tiles: dimensions.map((page, p) => ({ x: packed.positions[p]!.x / config.atlas.density, y: packed.positions[p]!.y / config.atlas.density, scale: packed.side / page.width })) };
        sheetUrls.set(cacheKey, sheet);
      }
      const level = levels[i]!;
      level.tiles ??= {};
      for (const p of bank.urls.keys()) { level.resources[`page:${bank.id}:${p}`] = sheet.key; level.tiles[`page:${bank.id}:${p}`] = { ...sheet.tiles[p]! }; }
    }
  }
  // The pages' own small levels only fed their sheets: they are neither offered nor published.
  for (let i = entries.length - 1; i >= 0; i--) if (replaced.has(entries[i]!.url)) entries.splice(i, 1);
  for (let i = receipts.length - 1; i >= 0; i--) if (replaced.has(receipts[i]!.url)) receipts.splice(i, 1);
  for (const url of replaced) await rm(resolve(publicDirectory, url.slice(config.publicBase.length)), { force: true });
  // A surface lens's pole atlas has its pages' texel density, so each level scales it by the pages' ratio; the first
  // view then loads its poles at the same level as its pages instead of at full resolution.
  for (const lens of lenses?.controls ?? []) if (lens.view !== 'interior' && lens.polesUrl) await prepare(`poles:${lens.id}`, lens.polesUrl, 'mounted');
  // Two complete largest banks can coexist during an atomic dataset switch.
  // Smaller completed levels share this same byte budget rather than multiply it.
  const maximumDecodedBytes = 2 * Math.max(...banks.map(bank => entries.filter(entry =>
    entry.key.startsWith(`page:${bank.id}:`) && !entry.key.includes(':level:')).reduce((sum, entry) => sum + entry.decodedBytes, 0)));
  // A map whose source holds less detail than the finest level stops at `maximumTextureWidth`: its finer levels read that
  // level's files, so no view loads a page that is only its source upsampled.
  for (const map of config.surface?.maps ?? []) {
    const cap = map.maximumTextureWidth;
    if (cap === undefined) continue;
    const capIndex = widths.indexOf(cap);
    if (capIndex < 0) throw new TypeError(`${map.name}: maximumTextureWidth ${cap} is not one of the texture level widths ${widths.join(', ')}.`);
    const lensIds = new Set(banks.filter(bank => basename(bank.urls[0]!, '.webp').replace(/@2x$/u, '') === map.name).map(bank => bank.id));
    if (!lensIds.size) throw new TypeError(`${map.name}: maximumTextureWidth names a map no surface bank reads.`);
    for (const level of levels.slice(capIndex + 1)) for (const key of Object.keys(level.resources)) {
      const lens = /^(?:page|poles):([^:]+)/u.exec(key)?.[1];
      if (!lens || !lensIds.has(lens)) continue;
      level.resources[key] = levels[capIndex]!.resources[key]!;
      const tile = levels[capIndex]!.tiles?.[key];
      // A copy: the presentation contract refuses an object shared between two places as cyclic.
      if (tile) (level.tiles ??= {})[key] = { ...tile }; else if (level.tiles) delete level.tiles[key];
    }
  }
  const offered = maximumWidth === undefined ? levels : levels.slice(0, widths.indexOf(maximumWidth) + 1);
  return { textureLevels: { hysteresis, levels: offered }, entries, maximumDecodedBytes,
    provenance: { schema: 'cssearth-prepared-texture-levels@1', kernel: 'lanczos3', encoding: 'source-webp-encoding', texelsPerCssPixel, receipts, sheets } };
}
