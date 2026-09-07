import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prepareCoarsePageGeometry, sampleCoarsePage, trimCoarsePageRgba } from './coarse-page.mjs';
import { prepareCoarseReplacements } from './coarse-replacements.mjs';
import { prepareCityIndex } from './prepare-index.mjs';
import { preparedCityAssetUrl } from '../../../../platform/prepared-map/city-asset-url.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function atomicJson(file, value) {
  const temporary = new URL(file.href + '.part');
  await writeFile(temporary, JSON.stringify(value) + '\n');
  await rename(temporary, file);
}

function createSourceWindow(pins, directory, limit) {
  const cache = new Map();
  let residentBytes = 0, peakBytes = 0, reads = 0;
  return {
    async get(keys) {
      assert.ok(keys.length <= 192, 'Prepared source window entry bound');
      const bank = new Map();
      for (const key of keys) {
        let data = cache.get(key);
        if (cache.has(key)) cache.delete(key);
        else {
          const pin = pins[key]; assert.ok(pin, `Missing pinned source ${key}`);
          const bytes = await readFile(new URL(pin.path, directory));
          assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
          const image = await sharp(bytes, { limitInputPixels: 65536 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          assert.equal(image.info.width, pin.width); assert.equal(image.info.height, pin.height);
          assert.equal(image.info.channels, 4);
          if (image.info.width === 1) { assert.equal(image.data[3], 0); data = null; }
          else { assert.equal(image.info.width, 256); assert.equal(image.info.height, 256); data = image.data; }
          while (cache.size && (cache.size >= 192 || residentBytes + (data?.length ?? 0) > limit)) {
            const oldest = cache.keys().next().value;
            residentBytes -= cache.get(oldest)?.length ?? 0; cache.delete(oldest);
          }
          residentBytes += data?.length ?? 0; reads++;
        }
        cache.set(key, data); bank.set(key, data);
        assert.ok(residentBytes <= limit, 'Decoded source window bound');
        peakBytes = Math.max(peakBytes, residentBytes);
      }
      return bank;
    },
    stats: () => ({ sourceReads: reads, peakSourceDecodedBytes: peakBytes }),
  };
}

// Preparation owns geographic sampling, row orientation, transparency trimming
// and retirement certificates. Runtime receives the existing page descriptor.
export async function prepareCoarseRaster(entry, scene, fineRoots, bank) {
  const address = { level: entry.level, x: entry.x, y: entry.y };
  const geometry = prepareCoarsePageGeometry(address, scene);
  const sampled = entry.empty ? Buffer.alloc(geometry.width * geometry.height * 4)
    : sampleCoarsePage(geometry, entry.resolution.zoom, (x, y) => {
      const key = `${entry.resolution.zoom}-${Math.floor(x / 256)}-${Math.floor(y / 256)}`;
      assert.ok(bank.has(key), `Unplanned source sample ${key}`);
      const data = bank.get(key);
      if (!data) return [0, 0, 0, 0];
      const at = ((y % 256) * 256 + x % 256) * 4;
      return data.subarray(at, at + 4);
    });
  const rgba = Buffer.alloc(sampled.length), stride = geometry.width * 4;
  for (let y = 0; y < geometry.height; y++) sampled.copy(rgba, y * stride, (geometry.height - y - 1) * stride, (geometry.height - y) * stride);
  const replacement = prepareCoarseReplacements(address, scene, fineRoots, { rgba, width: geometry.width, height: geometry.height });
  const trimmed = trimCoarsePageRgba(rgba, geometry.width, geometry.height);
  const bytes = await sharp(trimmed.rgba, { raw: { width: trimmed.width, height: trimmed.height, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
  assert.equal(decoded.length, trimmed.rgba.length);
  for (let i = 0; i < decoded.length; i += 4) {
    assert.equal(decoded[i + 3], trimmed.rgba[i + 3]);
    if (decoded[i + 3]) for (let c = 0; c < 3; c++) assert.equal(decoded[i + c], trimmed.rgba[i + c], 'Lossless coarse pixel round trip');
  }
  const { geographicMatrix, geographicProjection, coarseCoverageMatrix, outer, sourceBounds, ...page } = geometry;
  return { bytes, page: { ...page, key: entry.key, children: entry.children, replacement,
    width: trimmed.width, height: trimmed.height, textureBackgroundSize: trimmed.textureBackgroundSize,
    textureBackgroundPosition: trimmed.textureBackgroundPosition, rasterSource: 'prepared-raster@1' },
    source: { tiles: entry.tiles, zoom: entry.resolution.zoom ?? null, rgbaSha256: hash(rgba), encodedRows: 'south-to-north',
      empty: trimmed.empty, availability: entry.empty, crop: trimmed.crop } };
}

export async function prepareCoarseRelease({ plan, directory, scene, fine, project, onProgress = async () => {} }) {
  const inputBytes = await readFile(new URL('inputs-manifest.json', directory)), inputs = JSON.parse(inputBytes);
  assert.equal(inputs.planVersion, plan.version);
  assert.equal(hash(JSON.stringify(fine.roots)), plan.inputs.fineRootsSha256);
  assert.equal(fine.geometryVersion, plan.inputs.fineGeometryVersion);
  for (const source of plan.source) assert.equal(inputs.inputs[source.key]?.url, source.url);
  const files = ['src/planets/earth/tools/city/coarse-release.mjs', 'src/planets/earth/tools/city/prepare-index.mjs',
    'src/platform/prepared-map/city-asset-url.mjs', 'pnpm-lock.yaml'];
  const sources = { ...plan.inputs.sourceHashes,
    ...Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(new URL(file, project)))]))) };
  for (const [file, expected] of Object.entries(sources)) assert.equal(hash(await readFile(new URL(file, project))), expected, 'Preparation source changed');
  const identity = { schema: 'cssearth-global-coarse-release-inputs@1', planSha256: hash(JSON.stringify(plan)),
    inputsSha256: hash(inputBytes), sources, sharp: sharp.versions };
  const version = hash(JSON.stringify(identity)).slice(0, 16), release = new URL(`releases/${version}/`, directory);
  await mkdir(new URL('pages/', release), { recursive: true });
  const staging = new URL('assets/', release); await mkdir(staging, { recursive: true });
  await atomicJson(new URL('inputs.json', release), identity);
  const window = createSourceWindow(inputs.inputs, directory, plan.limits.decodedWindowBytes), pages = [], assets = [];
  let imageBytes = 0, empty = 0, restored = 0;
  for (const entry of plan.pages) {
    const receipt = new URL(`pages/${entry.key}.json`, release);
    let record;
    try { record = JSON.parse(await readFile(receipt)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (record) {
      assert.equal(record.version, version); assert.equal(record.page.key, entry.key);
      const bytes = await readFile(new URL(record.asset.filename, staging));
      assert.equal(bytes.length, record.asset.bytes); assert.equal(hash(bytes), record.asset.sha256); restored++;
    } else {
      const bank = await window.get(entry.tiles), result = await prepareCoarseRaster(entry, scene, fine.roots, bank);
      const sha256 = hash(result.bytes), filename = `city-${fine.dataset}-${entry.key}-${sha256.slice(0, 16)}.webp`;
      const url = preparedCityAssetUrl(fine.assetOrigin, 'scenes/earth', filename);
      const asset = { filename, url, bytes: result.bytes.length, sha256, type: 'image/webp' };
      assert.ok(imageBytes + asset.bytes <= plan.limits.outputBytes, 'Prepared coarse output limit');
      await writeFile(new URL(filename + '.part', staging), result.bytes);
      await rename(new URL(filename + '.part', staging), new URL(filename, staging));
      record = { version, page: { ...result.page, url, sha256, bytes: asset.bytes }, asset, source: result.source };
      await atomicJson(receipt, record);
    }
    pages.push(record.page); assets.push(record.asset); imageBytes += record.asset.bytes; empty += Number(record.source.empty);
    assert.ok(imageBytes <= plan.limits.outputBytes);
    if (pages.length % 32 === 0) {
      const disk = await statfs(fileURLToPath(directory));
      assert.ok(disk.bavail * disk.bsize >= plan.limits.minimumFreeBytes, 'Coarse preparation free-space reserve');
      await onProgress({ version, preparedPages: pages.length, totalPages: plan.pages.length, restored, empty, imageBytes, ...window.stats() });
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  const index = prepareCityIndex(pages, fine.dataset, scene, { assetOrigin: fine.assetOrigin, keyPrefix: 'scenes/earth' });
  let indexBytes = 0;
  for (const file of index.files) {
    const filename = new URL(file.url).pathname.split('/').at(-1);
    indexBytes += file.bytes.length;
    assert.ok(imageBytes + indexBytes <= plan.limits.outputBytes);
    await writeFile(new URL(filename, staging), file.bytes);
    assets.push({ filename, url: file.url, bytes: file.bytes.length, sha256: hash(file.bytes), type: 'application/json' });
  }
  for (const [file, expected] of Object.entries(sources)) assert.equal(hash(await readFile(new URL(file, project))), expected, 'Preparation source changed');
  const rootDecodedBytes = Buffer.byteLength(JSON.stringify(index.heads));
  const manifest = { schema: 'cssearth-global-coarse-release@1', version, planVersion: plan.version, identity,
    dataset: fine.dataset, fineGeometryVersion: fine.geometryVersion, fineRootsSha256: plan.inputs.fineRootsSha256, pages: pages.length, empty,
    imageBytes, indexBytes, files: assets.length, assets, staging: 'assets',
    sourceImages: plan.source.length, sourceBytes: Object.values(inputs.inputs).reduce((sum, pin) => sum + pin.bytes, 0),
    backing: { roots: index.heads, minimumZoom: 4, rootDecodedBytes },
    decodedPageBytes: Math.max(fine.decodedPageBytes, ...pages.map(page => page.width * page.height * 4)),
    complete: true,
    qualification: 'Complete local prepared coarse pyramid from hash-pinned provider inputs. Runtime global loading, publication, and public asset delivery remain unqualified.' };
  assert.equal(index.heads.length, plan.rootCount);
  await atomicJson(new URL('manifest.json', release), manifest);
  await atomicJson(new URL('prepared.json', directory), { version, directory: fileURLToPath(release) });
  await onProgress({ version, pages: pages.length, empty, imageBytes, indexBytes, rootDecodedBytes, ...window.stats(), complete: true });
  return { ...manifest, staging: fileURLToPath(staging), ...window.stats() };
}
