import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { BaseClient, BaseResponse, fromCustomClient, fromFile, writeArrayBuffer } from 'geotiff';

type Pair = [number, number];
export interface GeoTiffGridRecipe {
  schema: 'cssearth-geotiff-grid@1';
  source: { url: string; productId: string; width: number; height: number; origin: Pair; resolution: Pair;
    coordinates: 'degrees' | 'meters'; radius: number; centerLongitude: number; noData: number | null;
    bits: 8 | 16 | 32; sampleFormat: 1 | 2 | 3 };
  output: { width: number; height: number; radius: number };
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected GeoTIFF grid record.');
  return v as Record<string, unknown>;
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Expected finite grid number.');
  return v;
}
function dimension(v: unknown): number {
  const n = number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw new TypeError('Expected positive grid dimension.');
  return n;
}
function pair(v: unknown): Pair {
  if (!Array.isArray(v) || v.length !== 2) throw new TypeError('Expected grid coordinate pair.');
  return [number(v[0]), number(v[1])];
}
export function parseGeoTiffGridRecipe(value: unknown): GeoTiffGridRecipe {
  const r = record(value), s = record(r.source), o = record(r.output);
  if (r.schema !== 'cssearth-geotiff-grid@1' || typeof s.url !== 'string' || !/^https:\/\//.test(s.url) ||
      typeof s.productId !== 'string' || !s.productId || !['degrees', 'meters'].includes(String(s.coordinates)) ||
      typeof s.bits !== 'number' || ![8, 16, 32].includes(s.bits) ||
      typeof s.sampleFormat !== 'number' || ![1, 2, 3].includes(s.sampleFormat))
    throw new TypeError('Invalid GeoTIFF grid recipe.');
  const source = {url: s.url, productId: s.productId, width: dimension(s.width), height: dimension(s.height),
    origin: pair(s.origin), resolution: pair(s.resolution), coordinates: s.coordinates as 'degrees' | 'meters',
    radius: number(s.radius), centerLongitude: number(s.centerLongitude), noData: s.noData === null ? null : number(s.noData),
    bits: s.bits as 8 | 16 | 32, sampleFormat: s.sampleFormat as 1 | 2 | 3};
  const output = {width: dimension(o.width), height: dimension(o.height), radius: number(o.radius)};
  if (source.radius <= 0 || output.radius <= 0 || source.resolution[0] <= 0 || source.resolution[1] >= 0 ||
      output.width !== output.height * 2 || output.width * output.height > 16_777_216)
    throw new TypeError('Unbounded or unsupported output grid.');
  return {schema: r.schema, source, output};
}

class ResponseBytes extends BaseResponse {
  private response: Response;
  private bytes: ArrayBuffer;
  constructor(response: Response, bytes: ArrayBuffer) { super(); this.response = response; this.bytes = bytes; }
  override get status() { return this.response.status; }
  override getHeader(name: string) { return this.response.headers.get(name) ?? undefined; }
  override async getData() { return this.bytes; }
}
/** Require bounded ranges and a stable entity throughout one conversion. Digests
 * describe the ranges actually read, never pretend to identify an unread file. */
export class GridRangeClient extends BaseClient {
  entityTag: string | null = null;
  lastModified: string | null = null;
  totalBytes: number | null = null;
  transferredBytes = 0;
  readonly ranges: {start: number; end: number; sha256: string}[] = [];
  private transport: typeof fetch;
  private transferUrl: string;
  constructor(url: string, transport: typeof fetch = fetch) { super(url); this.transport = transport; this.transferUrl = url; }
  override async request(options: RequestInit = {}): Promise<BaseResponse> {
    const headers = new Headers(options.headers), match = /^bytes=(\d+)-(\d+)$/.exec(headers.get('range') ?? '');
    if (!match) throw new Error('Only one bounded GeoTIFF range may be requested.');
    const start = Number(match[1]), end = Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start || end - start >= 8 * 1024 * 1024)
      throw new Error('GeoTIFF request exceeds the eight MiB range limit.');
    if (this.entityTag) headers.set('If-Match', this.entityTag);
    else if (this.lastModified) headers.set('If-Unmodified-Since', this.lastModified);
    let failure: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.transport(this.transferUrl, {...options, headers,
          signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000)});
        const extent = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
        if (response.status !== 206 || !extent || Number(extent[1]) !== start ||
            Number(extent[2]) !== Math.min(end, Number(extent[3]) - 1)) {
          await response.body?.cancel(); throw new Error(`Invalid GeoTIFF range response: ${response.status}.`);
        }
        const etag = response.headers.get('etag'), modified = response.headers.get('last-modified'), size = Number(extent[3]);
        if (!Number.isSafeInteger(size) || size <= start || this.totalBytes !== null && this.totalBytes !== size ||
            this.entityTag !== null && this.entityTag !== etag || this.lastModified !== null && this.lastModified !== modified) {
          await response.body?.cancel(); throw new Error('Remote GeoTIFF changed during conversion.');
        }
        this.entityTag = etag; this.lastModified = modified; this.totalBytes = size;
        if (!etag && !modified) { await response.body?.cancel(); throw new Error('Remote GeoTIFF has no entity validator.'); }
        // Reuse a publisher redirect, while retaining the original URL as provenance.
        if (response.url.startsWith('https://')) this.transferUrl = response.url;
        const bytes = new ArrayBuffer(Number(extent[2]) - start + 1), view = new Uint8Array(bytes);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('GeoTIFF range has no body.');
        let written = 0;
        try {
          while (true) {
            const {done, value} = await reader.read(); if (done) break;
            if (written + value.length > view.length) throw new Error('Oversized GeoTIFF range.');
            view.set(value, written); written += value.length;
          }
        } finally { await reader.cancel(); reader.releaseLock(); }
        if (written !== view.length) throw new Error('Truncated GeoTIFF range.');
        this.transferredBytes += bytes.byteLength;
        this.ranges.push({start, end: Number(extent[2]), sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex')});
        return new ResponseBytes(response, bytes);
      } catch (error) { failure = error; }
    }
    throw failure;
  }
}

/** Source cells are areas. Choose the native cell containing each output centre;
 * retain native units and missing data. No averaging, palette or extrapolation. */
export function sourcePixel(recipe: GeoTiffGridRecipe, x: number, y: number): Pair | null {
  const s = recipe.source, longitude = -180 + (x + 0.5) * 360 / recipe.output.width;
  const latitude = 90 - (y + 0.5) * 180 / recipe.output.height;
  const delta = ((longitude - s.centerLongitude + 180) % 360 + 360) % 360 - 180;
  const factor = s.coordinates === 'degrees' ? 1 : s.radius * Math.PI / 180;
  const col = Math.floor((delta * factor - s.origin[0]) / s.resolution[0]);
  const row = Math.floor((latitude * factor - s.origin[1]) / s.resolution[1]);
  return col < 0 || row < 0 || col >= s.width || row >= s.height ? null : [col, row];
}
export function encodeGeoTiffGrid(values: Float32Array, recipe: GeoTiffGridRecipe): Uint8Array {
  const {width, height, radius} = recipe.output;
  return new Uint8Array(writeArrayBuffer(values, {width, height, SamplesPerPixel: 1, PhotometricInterpretation: 1,
    GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 32767,
    BitsPerSample: [32], SampleFormat: [3], GDAL_NODATA: '-99999',
    ModelPixelScale: [360 / width, 180 / height, 0], ModelTiepoint: [0, 0, 0, -180, 90, 0],
    GeoDoubleParams: [radius], GeoKeyDirectory: [1, 1, 0, 6, 1024, 0, 1, 2, 1025, 0, 1, 1,
      2054, 0, 1, 9102, 2057, 34736, 1, 0, 2058, 34736, 1, 0, 2061, 0, 1, 0]}));
}

export async function prepareGeoTiffGrid(recipe: GeoTiffGridRecipe, options: {
  localPath?: string; transport?: typeof fetch; progress?: (completeRows: number, totalRows: number) => void;
} = {}) {
  const client = options.localPath ? null : new GridRangeClient(recipe.source.url, options.transport);
  const tiff = options.localPath ? await fromFile(options.localPath)
    : await fromCustomClient(client!, {maxRanges: 0, allowFullFile: false});
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys(), dir = image.getFileDirectory(), s = recipe.source;
    const origin = image.getOrigin(), resolution = image.getResolution();
    if (!keys || keys.GTRasterTypeGeoKey !== 1 || keys.GeogSemiMajorAxisGeoKey !== s.radius ||
        keys.GeogSemiMinorAxisGeoKey !== s.radius || (keys.GeogPrimeMeridianLongGeoKey ?? 0) !== 0 ||
        (s.coordinates === 'degrees' ? keys.GTModelTypeGeoKey !== 2 || keys.GeogAngularUnitsGeoKey !== 9102 || s.centerLongitude !== 0
          : keys.GTModelTypeGeoKey !== 1 || keys.ProjCoordTransGeoKey !== 17 || keys.ProjLinearUnitsGeoKey !== 9001 ||
            (keys.ProjCenterLongGeoKey ?? keys.ProjNatOriginLongGeoKey) !== s.centerLongitude ||
            (keys.ProjCenterLatGeoKey ?? keys.ProjNatOriginLatGeoKey ?? 0) !== 0 ||
            (keys.ProjStdParallel1GeoKey ?? 0) !== 0 || (keys.ProjFalseEastingGeoKey ?? 0) !== 0 || (keys.ProjFalseNorthingGeoKey ?? 0) !== 0) ||
        image.getWidth() !== s.width || image.getHeight() !== s.height || image.getSamplesPerPixel() !== 1 ||
        image.getGDALNoData() !== s.noData || origin[0] !== s.origin[0] || origin[1] !== s.origin[1] ||
        resolution[0] !== s.resolution[0] || resolution[1] !== s.resolution[1] ||
        dir.getValue('BitsPerSample')?.[0] !== s.bits || (dir.getValue('SampleFormat')?.[0] ?? 1) !== s.sampleFormat)
      throw new Error(`GeoTIFF native grid/encoding changed: ${s.productId}.`);
    // Reading a single scanline of a tiled file can decode a whole tile row.
    // Bound that working set independently of the output size.
    const nativeRowBytes = Math.ceil(s.width / image.getTileWidth()) * image.getTileWidth() * image.getTileHeight() * s.bits / 8;
    if (nativeRowBytes > 8 * 1024 * 1024) throw new Error('Source tile row exceeds the bounded grid reader limit.');
    const {width, height} = recipe.output, values = new Float32Array(width * height).fill(-99999);
    let valid = 0, minimum = Infinity, maximum = -Infinity, zeroCount = 0, maxRoundingError = 0, next = 0, complete = 0;
    const anchors: {x: number; y: number; sourceColumn: number; sourceRow: number; value: number}[] = [];
    await Promise.all(Array.from({length: 8}, async () => {
      while (next < height) {
        const y = next++;
        let first: Pair | null = null;
        for (let x = 0; x < width && !first; x++) first = sourcePixel(recipe, x, y);
        if (first) {
          const row = await image.readRasters({window: [0, first[1], s.width, first[1] + 1], samples: [0], interleave: true});
          for (let x = 0; x < width; x++) {
            const at = sourcePixel(recipe, x, y); if (!at) continue;
            const value = row[at[0]];
            if (typeof value !== 'number') throw new TypeError('Non-numeric GeoTIFF sample.');
            if (!Number.isFinite(value) || value === s.noData) continue;
            if (value === -99999) throw new Error('Native value collides with compact no-data marker.');
            values[y * width + x] = value;
            if (values[y * width + x] !== value) throw new Error('Native sample cannot be preserved exactly as float32.');
            maxRoundingError = Math.max(maxRoundingError, Math.abs(values[y * width + x] - value));
            minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); valid++; if (value === 0) zeroCount++;
            if (y % 64 === 0 && x % 256 === 0) anchors.push({x, y, sourceColumn: at[0], sourceRow: at[1], value});
          }
        }
        complete++; if (complete % 64 === 0 || complete === height) options.progress?.(complete, height);
      }
    }));
    if (!valid) throw new Error('GeoTIFF grid has no valid native samples.');
    const bytes = encodeGeoTiffGrid(values, recipe);
    return {bytes, report: {schema: 'cssearth-geotiff-grid-conversion@1', source: s, output: recipe.output,
      processing: 'Native cell containing each output pixel centre; original sample units retained as float32; no averaging or gap fill.',
      valid, missing: width * height - valid, minimum, maximum, zeroCount, maxRoundingError, maximumNativeRowBytes: nativeRowBytes,
      sourceIdentity: client ? {url: client.url, etag: client.entityTag, lastModified: client.lastModified, totalBytes: client.totalBytes,
        transferredBytes: client.transferredBytes, ranges: client.ranges.sort((a, b) => a.start - b.start)} : {localPath: options.localPath},
      anchors: anchors.sort((a, b) => a.y - b.y || a.x - b.x), outputSha256: createHash('sha256').update(bytes).digest('hex'), outputBytes: bytes.length}};
  } finally { await tiff.close(); }
}
export async function readGeoTiffGridRecipe(root: string, path: string): Promise<GeoTiffGridRecipe> {
  const file = resolve(root, path), offset = relative(root, file);
  if (path.startsWith('/') || offset === '..' || offset.startsWith('../')) throw new Error('GeoTIFF recipe escapes source root.');
  return parseGeoTiffGridRecipe(JSON.parse(await readFile(file, 'utf8')));
}
