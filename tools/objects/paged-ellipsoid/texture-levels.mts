import { sha256 } from '../../../src/platform/sha256.mts';
import type { SurfaceBankPlan, SurfaceBankLenses } from './contracts.mts';
/** `maximumWidth`: the largest level the runtime may choose. Wider levels are still prepared (smaller levels are reduced
 * from the canonical page) but never offered, so no view downloads them. */
export interface TextureLevelConfiguration {widths:readonly number[];fixedWidth?:number;maximumWidth?:number;hysteresis:number;texelsPerCssPixel:number}
interface TextureLevelAsset {url:string;decodedBytes:number}
interface TextureLevelReceipt {source:string;sourceSha256:string;url:string;sha256:string;width:number;height:number;bottomPadding:number}
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { requireSurfacePages, surfaceBankInventory } from './surface-banks.mts';
import { encodeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';

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


/** Downsample the canonical prepared atlas offline. Padding before reduction
 * keeps both axes at exactly the same scale; CSS atlas addresses never change. */
export async function prepareTextureLevels({ config, plan, lenses, publicDirectory, banks: selectedBanks }: {config: {textureLevels?:TextureLevelConfiguration;atlas:{pageSize:number;density:number};camera:{logicalBodyDiameter:number};publicBase:string};plan?:SurfaceBankPlan;lenses?:SurfaceBankLenses;publicDirectory:string;banks?:readonly TextureLevelBank[]}) {
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
  const entries: (TextureLevelAsset & {key:string;pool:string})[] = [], receipts: TextureLevelReceipt[] = [], levels = widths.map((width, i) => ({
    // The canonical atlas density is relative to the authored logical globe.
    minimumDiameter: i ? config.camera.logicalBodyDiameter * config.atlas.density *
      widths[i - 1] / canonicalWidth / texelsPerCssPixel : 0,
    resources: {} as Record<string,string>,
  }));
  const urls = new Map<string, TextureLevelAsset[]>();
  await mkdir(publicDirectory, { recursive: true });
  const prepare = async (key: string, url: string, pool: string) => {
    let prepared = urls.get(url);
    if (!prepared) {
      const source = await readFile(resolve(publicDirectory, url.slice(config.publicBase.length)));
      const { width, height } = await sharp(source).metadata();
      if (!width || canonicalWidth % width || !height) throw new TypeError(`Atlas dimensions differ: ${url}`);
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
  // A surface lens's pole atlas has its pages' texel density, so each level scales it by the pages' ratio; the first
  // view then loads its poles at the same level as its pages instead of at full resolution.
  for (const lens of lenses?.controls ?? []) if (lens.view !== 'interior' && lens.polesUrl) await prepare(`poles:${lens.id}`, lens.polesUrl, 'mounted');
  // Two complete largest banks can coexist during an atomic dataset switch.
  // Smaller completed levels share this same byte budget rather than multiply it.
  const maximumDecodedBytes = 2 * Math.max(...banks.map(bank => entries.filter(entry =>
    entry.key.startsWith(`page:${bank.id}:`) && !entry.key.includes(':level:')).reduce((sum, entry) => sum + entry.decodedBytes, 0)));
  const offered = maximumWidth === undefined ? levels : levels.slice(0, widths.indexOf(maximumWidth) + 1);
  return { textureLevels: { hysteresis, levels: offered }, entries, maximumDecodedBytes,
    provenance: { schema: 'cssearth-prepared-texture-levels@1', kernel: 'lanczos3', encoding: 'source-webp-encoding', texelsPerCssPixel, receipts } };
}
