import { sha256 } from '../../../../src/platform/sha256.mts';
import { isArray } from '../../../../src/platform/is-array.mts';
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fromCustomClient } from "geotiff";
import { readWorldCoverCatalog, sourceTilesForBounds, worldCoverSourceEntry,
  worldCoverTileBounds } from '../worldcover-catalog.mts';

import type { GeographicBounds, WorldCoverEntry, WorldCoverSource, CitySourceWindow } from '../contracts.mts';
import { shape, text, parseWorldCoverSource } from '../source-records.mts';
import { hasErrorCode } from '../../../sources/source-values.mts';
interface RegionInput extends Partial<WorldCoverSource> { id: string; sources?: WorldCoverSource[]; unavailableTiles?: string[] }
interface RegionOptions { offline?: boolean; verifyOnly?: boolean; maximumReceivedBytes?: number; catalogDirectory?: URL }
interface AbsentSource { catalogSha256: string; tiles: string[]; pixels: number }
interface SourceProof extends WorldCoverSource { window: number[]; extractedSha256: string; width: number; height: number; nodataPixels: number; sourceMetadata: Record<string, unknown>; absentSource?: AbsentSource }
const parseRangeMetadata=shape({sha256:text,etag:text,contentRange:text});

// Preparation only. Pin the publisher's object ETag and hash cached range bytes;
// an S3 multipart ETag is an object validator, not a whole-file SHA256.
export async function openWorldCoverSource(value: unknown, cacheRoot: string,
  { offline = false, maximumReceivedBytes = 256*1024*1024 } = {}) {
  const entry = parseWorldCoverSource(value);
  if (!/^https:\/\/esa-worldcover-s2\.s3\.eu-central-1\.amazonaws\.com\//.test(entry.url) ||
      !/^[a-f0-9]{32}(?:-\d+)?$/.test(entry.etag) || !/^[NS]\d{2}[EW]\d{3}$/.test(entry.tile)) {
    throw new Error("Unpinned WorldCover source.");
  }
  const directory = resolve(cacheRoot, entry.tile, entry.etag);
  await mkdir(directory, { recursive: true });
  let receivedBytes = 0;
  let active = 0;
  const waiting: (() => void)[] = [];
  const client = {
    url: entry.url,
    async request({ headers, signal }: RequestInit = {}) {
      const range = new Headers(headers).get("range") ?? "";
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!match) throw new Error("Expected a bounded source range.");
      const length = Number(match[2]) - Number(match[1]) + 1;
      if (length <= 0 || length > 16 * 1024 * 1024) throw new Error("Invalid bounded source range.");
      const expectedEnd = Math.min(Number(match[2]), entry.sourceBytes - 1);
      const expectedRange = `bytes ${match[1]}-${expectedEnd}/${entry.sourceBytes}`;
      const expectedLength = expectedEnd - Number(match[1]) + 1;
      if (expectedLength <= 0) throw new Error("Source range exceeds its pinned file.");
      const path = resolve(directory, `${match[1]}-${match[2]}`);
      let bytes;
      let metadata;
      try {
        [bytes, metadata] = await Promise.all([
          readFile(`${path}.bin`),
          readFile(`${path}.json`, "utf8").then(value=>parseRangeMetadata(JSON.parse(value))),
        ]);
        if (sha256(bytes) !== metadata.sha256 || metadata.etag !== entry.etag ||
            metadata.contentRange !== expectedRange || bytes.length !== expectedLength) {
          throw new Error(`Corrupt cached source range: ${path}`);
        }
      } catch (error) {
        if (!hasErrorCode(error,"ENOENT")) throw error;
        if (offline) throw new Error(`Missing cached WorldCover range: ${path}`);
        if (active >= 4) await new Promise<void>((resume) => waiting.push(resume));
        active += 1;
        try {
          ({ bytes, metadata } = await fetchPinnedWorldCoverRange(entry, range, signal,
            length, expectedRange, expectedLength));
          receivedBytes += bytes.length;
          if (receivedBytes > maximumReceivedBytes) {
            throw new Error("Source proof exceeded its 256 MiB per-region download bound.");
          }
          await writeFile(`${path}.bin.partial`, bytes);
          await rename(`${path}.bin.partial`, `${path}.bin`);
          await writeFile(`${path}.json`, JSON.stringify(metadata));
        } finally {
          active -= 1;
          waiting.shift()?.();
        }
      }
      return {
        ok: true,
        status: 206,
        getHeader(name: string) {
          return name.toLowerCase() === "content-range"
            ? metadata.contentRange
            : name.toLowerCase() === "content-type" ? "image/tiff" : undefined;
        },
        async getData() {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
        },
      };
    },
  };
  const sourceOptions: NonNullable<Parameters<typeof fromCustomClient>[1]> & { blockSize: number; cacheSize: number } = { blockSize: 65536, cacheSize: 64 };
  const tiff = await fromCustomClient(client, sourceOptions);
  const image = await tiff.getImage();
  const metadata = await image.getGDALMetadata();
  const geo = await image.getGeoKeys();
  const fileDirectory = image.getFileDirectory();
  const bits = Array.from(fileDirectory.getValue("BitsPerSample")??[]);
  if (image.getWidth() !== 12000 || image.getHeight() !== 12000 ||
      image.getSamplesPerPixel() !== 4 || !geo || !metadata || geo.GeographicTypeGeoKey !== 4326 ||
      bits.length !== 4 || !bits.every(value=>value===16) ||
      !Array.from(fileDirectory.getValue("SampleFormat")??[1]).every(value=>value===1) ||
      metadata.product_tile !== entry.tile ||
      metadata.product_type !== "Sentinel-2 median L2A (RGBNIR) composite" ||
      metadata.time_start !== "2021-01-01T00:00:00Z" ||
      metadata.product_version !== "V2.0.0" ||
      typeof metadata.license !== "string" || !metadata.license.startsWith("CC-BY 4.0")) {
    await tiff.close();
    throw new Error("WorldCover source metadata does not match its pinned contract.");
  }
  return {
    image,
    metadata,
    stats: () => ({ receivedBytes }),
    close: () => tiff.close(),
  };
}

async function fetchPinnedWorldCoverRange(entry: WorldCoverSource, range: string, signal: AbortSignal | null | undefined, maximumLength: number,
  expectedRange: string, expectedLength: number) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(entry.url, {
        headers: { Range: range, "If-Match": `"${entry.etag}"` },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      });
      if (response.status !== 206 || response.headers.get("etag") !== `"${entry.etag}"` ||
          Number(response.headers.get("content-length")) > maximumLength) {
        await response.body?.cancel();
        throw new Error(`WorldCover range/pin failure: ${entry.tile} ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = { etag: entry.etag, contentRange: response.headers.get("content-range"),
        sha256: sha256(bytes) };
      if (metadata.contentRange !== expectedRange || bytes.length !== expectedLength) {
        throw new Error("WorldCover source range changed.");
      }
      return { bytes, metadata: {...metadata,contentRange:expectedRange} };
    } catch (error) {
      lastError = error;
      await response?.body?.cancel().catch(() => {});
      if (signal?.aborted || attempt === 3) throw error;
      await new Promise(resolveDelay => setTimeout(resolveDelay, 250 * 2 ** attempt));
    }
  }
  throw lastError;
}

// One bounded preparation window, including source-tile and antimeridian
// crossings. Read one COG crop at a time into its exact integer-grid position.
// Missing pixels remain transparent. Only explicitly declared, catalog-proven
// absent tiles may be omitted; a missing pin or failed download remains an error.
export const CITY_SOURCE_WINDOW_MAX_PIXELS = 64*1024*1024;

export function citySourceWindow(bounds: GeographicBounds): CitySourceWindow {
  const grid=[Math.floor(bounds.west*12000),Math.floor(-bounds.north*12000),
    Math.ceil(bounds.east*12000),Math.ceil(-bounds.south*12000)];
  const width=grid[2]-grid[0],height=grid[3]-grid[1];
  if(![...grid,width,height].every(Number.isSafeInteger)||width<=0||height<=0)throw new Error('Invalid city source window.');
  return {grid,width,height,pixels:width*height};
}

function tileWindow(tile: string,bounds: GeographicBounds,grid: readonly number[]) {
  const {west,south}=worldCoverTileBounds(tile);
  const shift=360*Math.round(((bounds.west+bounds.east)/2-west-.5)/360);
  const tileX=Math.round((west+shift)*12000),tileY=Math.round(-(south+1)*12000);
  const window=[Math.max(0,grid[0]-tileX),Math.max(0,grid[1]-tileY),
    Math.min(12000,grid[2]-tileX),Math.min(12000,grid[3]-tileY)];
  return {tileX,tileY,shift,window,pixels:Math.max(0,window[2]-window[0])*Math.max(0,window[3]-window[1])};
}

export function validateWorldCoverRegionSources(region: RegionInput,bounds: GeographicBounds,catalog: ReadonlyMap<string,WorldCoverEntry>) {
  const coverage=sourceTilesForBounds(bounds,catalog);
  const entries=region.sources??[parseWorldCoverSource(region)];
  const actual=entries.map(entry=>entry.tile).sort();
  const expected=coverage.available.map(entry=>entry.tile).sort();
  if(!entries.length||JSON.stringify(actual)!==JSON.stringify(expected)) {
    throw new Error(`${region.id}: source pins must cover every listed tile exactly once.`);
  }
  for(const entry of entries) {
    const pin=worldCoverSourceEntry(catalog.get(entry.tile));
    if(entry.url!==pin.url||entry.etag!==pin.etag||entry.sourceBytes!==pin.sourceBytes) {
      throw new Error(`${entry.tile}: source does not match the pinned global inventory.`);
    }
  }
  const absent=region.unavailableTiles??[];
  if(!isArray(absent)||JSON.stringify([...absent].sort())!==JSON.stringify(coverage.unavailable.sort())) {
    throw new Error(`${region.id}: absent source tiles must be explicitly declared and match the pinned inventory.`);
  }
  const {grid}=citySourceWindow(bounds);
  return {entries,absentSourcePixels:absent.reduce((sum,tile)=>sum+tileWindow(tile,bounds,grid).pixels,0)};
}

const catalogs=new Map<string,ReturnType<typeof readWorldCoverCatalog>>();

export async function readWorldCoverRegion(region: RegionInput, bounds: GeographicBounds, color: { bands: number[]; reflectanceWhite: number; gamma: number }, cacheRoot: string, options: RegionOptions = {}) {
  const pixelsPerDegree = 12000;
  const {grid,width,height,pixels:windowPixels}=citySourceWindow(bounds);
  if (windowPixels > CITY_SOURCE_WINDOW_MAX_PIXELS) {
    throw new Error(`${region.id}: source window exceeds the 64 Mi-pixel preparation bound; split the prepared region.`);
  }
  const directory=options.catalogDirectory;
  if(!directory)throw new TypeError('WorldCover observation requires its source catalogue directory.');
  const key=String(directory);
  if(!catalogs.has(key))catalogs.set(key,readWorldCoverCatalog({directory}));
  const catalog=await catalogs.get(key)!;
  const {entries,absentSourcePixels}=validateWorldCoverRegionSources(region,bounds,catalog.entries);
  const rgba = options.verifyOnly ? null : Buffer.alloc(width*height*4);
  const proofs: SourceProof[] = [];
  let singleSourcePoint;
  let coveredPixels = 0, nodataPixels = 0, receivedBytes = 0;
  for (const entry of entries) {
    const input = await openWorldCoverSource(entry,cacheRoot,
      {...options,maximumReceivedBytes:256*1024*1024-receivedBytes});
    try {
      const image = input.image, [originX,originY] = image.getOrigin(), resolution = image.getResolution();
      const match = /^([NS])(\d{2})([EW])(\d{3})$/.exec(entry.tile);
      if (!match) throw new Error("Source tile identity is invalid");
      const expectedX = Number(match[4])*(match[3]==='W'?-1:1);
      const expectedY = Number(match[2])*(match[1]==='S'?-1:1)+1;
      if (Math.abs(originX-expectedX)>1e-9 || Math.abs(originY-expectedY)>1e-9 ||
          Math.abs(resolution[0]-1/pixelsPerDegree)>1e-12 || Math.abs(resolution[1]+1/pixelsPerDegree)>1e-12) {
        throw new Error(`${entry.tile}: unexpected source georeferencing.`);
      }
      const {shift,tileX,tileY,window}=tileWindow(entry.tile,bounds,grid);
      const cropWidth = window[2]-window[0], cropHeight = window[3]-window[1];
      if (!region.sources) singleSourcePoint=(longitude: number,latitude: number)=>[
        (longitude-shift-originX)/resolution[0]-window[0],(latitude-originY)/resolution[1]-window[1]];
      if (cropWidth <= 0 || cropHeight <= 0) throw new Error(`${entry.tile}: pinned tile does not intersect its region.`);
      const pixels = await image.readRasters({window,samples:color.bands,interleave:true});
      const extractedSha256 = sha256(Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength));
      if (entry.extractedSha256 && entry.extractedSha256 !== extractedSha256) {
        throw new Error(`${entry.tile}: extracted source hash mismatch.`);
      }
      let missingCount = 0;
      for (let y=0;y<cropHeight;y++) for (let x=0;x<cropWidth;x++) {
        const offset=(y*cropWidth+x)*3;
        const missing=pixels[offset]===0&&pixels[offset+1]===0&&pixels[offset+2]===0;
        missingCount+=Number(missing);
        if (!rgba) continue;
        const target=((tileY+window[1]-grid[1]+y)*width+tileX+window[0]-grid[0]+x)*4;
        for(let c=0;c<3;c++)rgba[target+c]=Math.round(255*Math.min(1,pixels[offset+c]/color.reflectanceWhite)**(1/color.gamma));
        rgba[target+3]=missing?0:255;
      }
      coveredPixels+=cropWidth*cropHeight;
      nodataPixels+=missingCount;
      receivedBytes+=input.stats().receivedBytes;
      proofs.push({...entry,window,extractedSha256,width:cropWidth,height:cropHeight,
        nodataPixels:missingCount,sourceMetadata:input.metadata});
    } finally { await input.close(); }
  }
  if (coveredPixels+absentSourcePixels !== width*height) throw new Error(`${region.id}: pinned tiles leave an unprepared source gap.`);
  const provenance: SourceProof | (Omit<RegionInput, "sources"> & { width: number; height: number; nodataPixels: number; sources: SourceProof[]; absentSource?: AbsentSource }) = region.sources ? {...region,width,height,nodataPixels,sources:proofs} : proofs[0];
  if(absentSourcePixels)provenance.absentSource={catalogSha256:catalog.pin.expectedSha256,
    tiles:[...(region.unavailableTiles ?? [])],pixels:absentSourcePixels};
  return {rgba,width,height,provenance,receivedBytes,
    sourcePoint:singleSourcePoint??((longitude: number,latitude: number)=>[longitude*pixelsPerDegree-grid[0],-latitude*pixelsPerDegree-grid[1]])};
}
