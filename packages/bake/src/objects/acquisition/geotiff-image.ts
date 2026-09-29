/** Offline reduction of a publisher's global byte image. Read bounded row windows,
 * average native pixel areas, and keep source gaps separate from dark observations. */
import sharp from 'sharp';
import {fromFile} from 'geotiff';
import {createWriteStream} from 'node:fs';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {containedPath} from '../sources/index.ts';
import {missingCoverageColor} from '../../raster/index.ts';
import {withIdleTimeout} from '../sources/index.ts';
import {assertGeoTiffGrid, parseGeoTiffGridRecipe, type GeoTiffGridRecipe} from './geotiff-grid.ts';

export interface GeoTiffImageRecipe {
  schema: 'cssearth-geotiff-image@1';
  source: GeoTiffGridRecipe['source'] & {samples: 1 | 3};
  output: GeoTiffGridRecipe['output'];
}
export function parseGeoTiffImageRecipe(value: unknown): GeoTiffImageRecipe {
  if (!value || typeof value !== 'object' || !('schema' in value) || value.schema !== 'cssearth-geotiff-image@1')
    throw new TypeError('Invalid GeoTIFF image recipe.');
  const grid = parseGeoTiffGridRecipe({...value, schema: 'cssearth-geotiff-grid@1'});
  if (!('source' in value) || !value.source || typeof value.source !== 'object' || !('samples' in value.source) ||
      value.source.samples !== 1 && value.source.samples !== 3) throw new TypeError('Expected grayscale or RGB samples.');
  const s = grid.source, o = grid.output;
  const factor = s.coordinates === 'degrees' ? 1 : s.radius * Math.PI / 180;
  if (s.bits !== 8 || s.sampleFormat !== 1 || s.centerLongitude !== 0 || s.width !== s.height * 2 ||
      o.width > s.width || o.radius !== s.radius ||
      Math.abs(s.origin[0] / factor + 180) > 1e-6 || Math.abs(s.origin[1] / factor - 90) > 1e-6 ||
      Math.abs(s.resolution[0] * s.width / factor - 360) > 1e-6 ||
      Math.abs(s.resolution[1] * s.height / factor + 180) > 1e-6)
    throw new TypeError('Image reduction requires a global north-up byte grid, -180 to 180 degrees.');
  return {schema: 'cssearth-geotiff-image@1', source: {...s, samples: value.source.samples}, output: o};
}
export async function readGeoTiffImageRecipe(root: string, path: string): Promise<GeoTiffImageRecipe> {
  return parseGeoTiffImageRecipe(JSON.parse(await readFile(containedPath(root, path), 'utf8')));
}
/** For a fractional boundary, integrate the piecewise-constant native pixel areas. */
function integral(prefix: Float64Array, x: number) {
  const i = Math.floor(x);
  return prefix[i]! + (x - i) * ((prefix[i + 1] ?? prefix[i]!) - prefix[i]!);
}
export async function prepareGeoTiffImage(recipe: GeoTiffImageRecipe, options: {
  localPath?: string; transport?: typeof fetch; progress?: (row: number, rows: number) => void;
} = {}) {
  const s = recipe.source, o = recipe.output;
  const temp = options.localPath ? null : await mkdtemp(join(tmpdir(), 'geotiff-image-'));
  const path = options.localPath ?? join(temp!, 'native.tif');
  try {
    if (!options.localPath) {
      const response = await (options.transport ?? fetch)(s.url, {signal: AbortSignal.timeout(3_600_000)});
      if (response.status !== 200 || !response.body) {
        await response.body?.cancel(); throw new Error(`Native image download failed: ${response.status}.`);
      }
      const expected = Number(response.headers.get('content-length'));
      const maximum = s.width * s.height * s.samples + 64 * 1024 * 1024;
      if (!Number.isSafeInteger(expected) || expected < 1 || expected > maximum) {
        await response.body.cancel(); throw new Error('Native image download has an unbounded size.');
      }
      let bytes = 0;
      const bounded = new Transform({transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length; callback(bytes > expected ? new Error('Oversized native image.') : null, chunk);
      }});
      const reader = response.body.getReader();
      const stream = Readable.from((async function* () {
        try {while (true) {const item = await reader.read(); if (item.done) break; yield item.value;}}
        finally {await reader.cancel(); reader.releaseLock();}
      })());
      await pipeline(withIdleTimeout(stream, 120000), bounded, createWriteStream(path));
      if (bytes !== expected) throw new Error('Truncated native image.');
    }
    const tiff = await fromFile(path);
    try {
      const image = await tiff.getImage();
      assertGeoTiffGrid(image, s, s.samples);
      const dir = image.getFileDirectory();
      if (dir.getValue('PhotometricInterpretation') !== (s.samples === 1 ? 1 : 2))
        throw new Error('Expected black-is-zero grayscale or RGB, without a palette.');
      const dx = s.width / o.width, dy = s.height / o.height;
      const rowBytes = s.width * (Math.ceil(dy) + image.getTileHeight() * 2) * s.samples;
      if (rowBytes > 64 * 1024 * 1024) throw new Error('Native image row window exceeds 64 MiB.');
      const rgb = new Uint8Array(o.width * o.height * 3);
      const prefix = Array.from({length: s.samples + 1}, () => new Float64Array(s.width + 1));
      let missing = 0, partial = 0;
      const anchors: {x: number; y: number; rgb: number[]; observedFraction: number}[] = [];
      for (let y = 0; y < o.height; y++) {
        const top = y * dy, bottom = (y + 1) * dy, first = Math.floor(top), last = Math.ceil(bottom);
        const pixels = await image.readRasters({window: [0, first, s.width, last], interleave: true});
        const sums = Array.from({length: s.samples + 1}, () => new Float64Array(o.width));
        for (let sy = first; sy < last; sy++) {
          const weight = Math.min(bottom, sy + 1) - Math.max(top, sy);
          for (let x = 0; x < s.width; x++) {
            const at = ((sy - first) * s.width + x) * s.samples;
            let valid = s.noData === null;
            for (let c = 0; c < s.samples; c++) if (pixels[at + c] !== s.noData) valid = true;
            prefix[s.samples]![x + 1] = prefix[s.samples]![x]! + Number(valid);
            for (let c = 0; c < s.samples; c++)
              prefix[c]![x + 1] = prefix[c]![x]! + (valid ? Number(pixels[at + c]) : 0);
          }
          for (let x = 0; x < o.width; x++) for (let c = 0; c <= s.samples; c++)
            sums[c]![x] += weight * (integral(prefix[c]!, (x + 1) * dx) - integral(prefix[c]!, x * dx));
        }
        for (let x = 0; x < o.width; x++) {
          const area = sums[s.samples]![x]!, offset = (y * o.width + x) * 3;
          if (area === 0) {
            missing++;
            rgb.set(missingCoverageColor(-180 + (x + .5) * 360 / o.width, 90 - (y + .5) * 180 / o.height, 180 / o.height), offset);
          } else {
            if (area < dx * dy - 1e-8) partial++;
            for (let c = 0; c < 3; c++) rgb[offset + c] = Math.round(sums[s.samples === 1 ? 0 : c]![x]! / area);
          }
          if (y % 256 === 0 && x % 512 === 0) anchors.push({x, y, rgb: Array.from(rgb.subarray(offset, offset + 3)), observedFraction: area / (dx * dy)});
        }
        if (y % 128 === 0 || y + 1 === o.height) options.progress?.(y + 1, o.height);
      }
      const bytes = await sharp(rgb, {raw: {width: o.width, height: o.height, channels: 3}}).png().toBuffer();
      return {bytes, report: {schema: 'cssearth-geotiff-image-conversion@1', source: s, output: o,
        processing: 'Native pixel-area mean over each output footprint; all-zero no-data pixels excluded. No observed area is gray grid; partial footprints average only their observations. No gap reconstruction or new contrast stretch.',
        sourceIdentity: {bytes: (await stat(path)).size}, missing, partial, anchors, maximumRowBytes: rowBytes,
        outputBytes: bytes.length}};
    } finally {await tiff.close();}
  } finally {if (temp) await rm(temp, {recursive: true, force: true});}
}
