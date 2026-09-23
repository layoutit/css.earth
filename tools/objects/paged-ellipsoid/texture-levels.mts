import { sha256 } from '../../../src/platform/sha256.mts';
import type { SurfaceBankPlan, SurfaceBankLenses } from './contracts.mts';
export interface TextureLevelConfiguration {widths:readonly number[];fixedWidth?:number;hysteresis:number;texelsPerCssPixel:number}
interface TextureLevelAsset {url:string;decodedBytes:number}
interface TextureLevelReceipt {source:string;sourceSha256:string;url:string;sha256:string;width:number;height:number;bottomPadding:number}
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { requireSurfacePages, surfaceBankInventory } from './surface-banks.mts';

export interface TextureLevelBank {id: string; urls: readonly string[]}


/** Downsample the canonical prepared atlas offline. Padding before reduction
 * keeps both axes at exactly the same scale; CSS atlas addresses never change. */
export async function prepareTextureLevels({ config, plan, lenses, publicDirectory, banks: selectedBanks }: {config: {textureLevels?:TextureLevelConfiguration;atlas:{pageSize:number;density:number};camera:{logicalBodyDiameter:number};publicBase:string};plan?:SurfaceBankPlan;lenses?:SurfaceBankLenses;publicDirectory:string;banks?:readonly TextureLevelBank[]}) {
  if (!config.textureLevels) return null;
  const { widths, fixedWidth, hysteresis, texelsPerCssPixel } = config.textureLevels;
  const canonicalWidth = config.atlas.pageSize;
  if (!Array.isArray(widths) || widths.at(-1) !== canonicalWidth || widths.some((width, i) =>
    !Number.isInteger(width) || width < 1 || canonicalWidth % width || i > 0 && width <= widths[i - 1]) ||
    (fixedWidth !== undefined && !widths.includes(fixedWidth)) ||
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
  for (const bank of banks) for (const [page, url] of bank.urls.entries()) {
    const key = `page:${bank.id}:${page}`;
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
        let output = source, outputHeight = height;
        if (targetWidth !== width) {
          // Raw intermediate forces extension to happen before resize in sharp.
          const padded = await sharp(source).ensureAlpha().extend({ bottom: padding, background: '#00000000' }).raw().toBuffer({ resolveWithObject: true });
          outputHeight = (height + padding) / divisor;
          output = await sharp(padded.data, { raw: padded.info }).resize(targetWidth, outputHeight, { kernel: 'lanczos3' }).webp({ lossless: true, effort: 4 }).toBuffer();
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
      entries.push({ key: resource, ...asset, pool: 'pages' });
    }
  }
  // Two complete largest banks can coexist during an atomic dataset switch.
  // Smaller completed levels share this same byte budget rather than multiply it.
  const maximumDecodedBytes = 2 * Math.max(...banks.map(bank => entries.filter(entry =>
    entry.key.startsWith(`page:${bank.id}:`) && !entry.key.includes(':level:')).reduce((sum, entry) => sum + entry.decodedBytes, 0)));
  return { textureLevels: { hysteresis, levels }, entries, maximumDecodedBytes,
    provenance: { schema: 'cssearth-prepared-texture-levels@1', kernel: 'lanczos3', encoding: 'lossless-webp', texelsPerCssPixel, receipts } };
}
