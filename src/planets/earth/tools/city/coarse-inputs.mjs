import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, link, statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function atomicJson(file, data) {
  await writeFile(new URL(file.href + '.part'), JSON.stringify(data) + '\n');
  await rename(new URL(file.href + '.part'), file);
}

async function validateImage(bytes, limit) {
  assert.ok(bytes.length > 0 && bytes.length <= limit, 'Bounded coarse source image');
  const info = await sharp(bytes, { limitInputPixels: 65536 }).metadata();
  assert.equal(info.format, 'png', 'Expected provider PNG');
  assert.ok(info.width === 256 && info.height === 256 || info.width === 1 && info.height === 1, 'Provider image dimensions');
  if (info.width === 1) {
    const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
    assert.equal(rgba[3], 0, 'Only transparent provider placeholders are supported');
  }
  return { width: info.width, height: info.height };
}

// Source images stay pinned by their bytes, independent of the provider URL's
// year/version label. Receipts are per tile, so interruption cannot invalidate
// other completed transfers. A supplied seed manifest reuses verified bytes.
export async function acquireCoarseInputs({ plan, directory, seedManifests = [], offline = false,
  concurrency = 4, fetchImpl = fetch, onProgress = async () => {} }) {
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4);
  assert.ok(plan.source.length <= plan.limits.sourceImages);
  assert.equal(new Set(plan.source.map(source => source.key)).size, plan.source.length);
  const root = new URL('inputs/', directory);
  await mkdir(root, { recursive: true });
  const seeds = new Map(), pins = {}, stats = { verified: 0, reused: 0, acquired: 0, sourceBytes: 0, receivedBytes: 0 };
  for (const file of seedManifests) {
    const manifest = JSON.parse(await readFile(file));
    assert.equal(manifest.schema, 'cssearth-pinned-wmts-inputs@1');
    for (const pin of Object.values(manifest.inputs)) {
      if (!seeds.has(pin.url)) seeds.set(pin.url, { ...pin, file: new URL(pin.path, file) });
    }
  }
  const reserve = async () => {
    const disk = await statfs(fileURLToPath(directory));
    assert.ok(disk.bavail * disk.bsize >= plan.limits.minimumFreeBytes, 'Coarse input free-space reserve');
  };
  const charge = bytes => {
    assert.ok(stats.sourceBytes + bytes.length <= plan.limits.sourceBytes, 'Coarse pinned source limit');
    stats.sourceBytes += bytes.length;
  };
  const publishBlob = async (source, pin, bytes, target) => {
    const temporary = new URL(`${source.key}-${pin.sha256}.part`, root);
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  };
  await reserve();
  const controller = new AbortController();
  let cursor = 0;
  async function download(source) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response;
      try {
        response = await fetchImpl(source.url, { credentials: 'omit', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        if ([429, 500, 502, 503, 504].includes(response.status)) {
          const header = response.headers.get('retry-after');
          const seconds = header && /^\d+$/.test(header) ? Number(header) : (Date.parse(header) - Date.now()) / 1000;
          await response.body?.cancel();
          if (attempt === 3) throw new Error(`Coarse source exhausted retries: ${source.key} HTTP ${response.status}`);
          await pause(Math.min(60000, Math.max(500 * 2 ** attempt, Number.isFinite(seconds) ? seconds * 1000 : 0)));
          continue;
        }
        assert.equal(response.status, 200, `Coarse source ${source.key}`);
        assert.ok(response.headers.get('content-type')?.startsWith('image/png'), 'Coarse source media type');
        const declared = Number(response.headers.get('content-length') || 0);
        assert.ok(declared <= plan.limits.imageBytes, 'Coarse source declared size');
        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length; stats.receivedBytes += chunk.length;
          assert.ok(size <= plan.limits.imageBytes && stats.receivedBytes <= plan.limits.sourceBytes, 'Coarse source transfer limit');
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        const dimensions = await validateImage(bytes, plan.limits.imageBytes);
        return { bytes, pin: { ...source, ...dimensions, bytes: bytes.length, sha256: hash(bytes),
          retrievedAt: new Date().toISOString(), etag: response.headers.get('etag'), cacheControl: response.headers.get('cache-control') } };
      } catch (error) {
        await response?.body?.cancel().catch(() => {});
        // Only transport failures are retried here. Status retries above are
        // bounded separately; malformed or oversized source data fails closed.
        if (controller.signal.aborted || attempt === 3 || !(error instanceof TypeError || error.name === 'TimeoutError')) throw error;
        await pause(500 * 2 ** attempt);
      }
    }
  }
  async function worker() {
    while (cursor < plan.source.length && !controller.signal.aborted) {
      const source = plan.source[cursor++], receipt = new URL(`${source.key}.json`, root);
      try {
        let pin, bytes, reused = false;
        try { pin = JSON.parse(await readFile(receipt)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (pin) {
          assert.equal(pin.url, source.url); assert.equal(pin.key, source.key);
          assert.equal(pin.path, `inputs/${pin.sha256}.png`);
          bytes = await readFile(new URL(pin.path, directory));
          assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
          const dimensions = await validateImage(bytes, plan.limits.imageBytes);
          assert.equal(dimensions.width, pin.width); assert.equal(dimensions.height, pin.height);
          charge(bytes);
        } else {
          const seed = seeds.get(source.url);
          if (seed) {
            bytes = await readFile(seed.file);
            assert.equal(bytes.length, seed.bytes); assert.equal(hash(bytes), seed.sha256);
            const dimensions = await validateImage(bytes, plan.limits.imageBytes);
            const { file, path, ...metadata } = seed;
            pin = { ...metadata, ...source, ...dimensions }; reused = true;
          } else {
            assert.ok(!offline, `Missing offline coarse input ${source.key}`);
            ({ bytes, pin } = await download(source));
          }
          charge(bytes);
          pin.path = `inputs/${pin.sha256}.png`;
          const target = new URL(pin.path, directory);
          if (seed) {
            try { await link(seed.file, target); }
            catch (error) {
              if (error.code === 'EXDEV') await publishBlob(source, pin, bytes, target);
              else if (error.code !== 'EEXIST') throw error;
            }
          } else {
            // Equal transparent tiles often complete concurrently. Publish a
            // fully written file atomically; no reader sees a partial hash file.
            await publishBlob(source, pin, bytes, target);
          }
          assert.equal(hash(await readFile(target)), pin.sha256);
          await atomicJson(receipt, pin);
          stats[reused ? 'reused' : 'acquired']++;
        }
        pins[source.key] = pin; stats.verified++;
        if (stats.verified % 64 === 0) { await reserve(); await onProgress({ ...stats, total: plan.source.length }); }
      } catch (error) { controller.abort(error); throw error; }
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: concurrency }, worker));
  const failure = workers.find(result => result.status === 'rejected');
  if (failure) throw controller.signal.reason ?? failure.reason;
  assert.equal(stats.verified, plan.source.length);
  const manifest = { schema: 'cssearth-pinned-wmts-inputs@1', planVersion: plan.version,
    publisher: 'ESA WorldCover consortium / Terrascope', dataset: 'esa-worldcover-rgbnir-2021-v200',
    sourcePage: 'https://esa-worldcover.org/en/data-access', license: 'CC-BY-4.0',
    credit: 'ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
    inputs: Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b))) };
  await atomicJson(new URL('inputs-manifest.json', directory), manifest);
  await onProgress({ ...stats, total: plan.source.length, complete: true });
  return { manifest, stats };
}
