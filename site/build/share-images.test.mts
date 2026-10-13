import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import filesystemDefault, { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { mock, test } from 'node:test';
import sharp from 'sharp';

const partialChildRoot = process.env.SHARE_IMAGES_TEST_PARTIAL_ROOT;
const faultMode = process.env.SHARE_IMAGES_TEST_FAULT_MODE ?? 'partial';
if (partialChildRoot !== undefined) {
  if (!partialChildRoot || !join(partialChildRoot, 'site/public').startsWith(tmpdir())) throw new TypeError('Invalid partial-write fixture root.');
  if (faultMode !== 'partial' && faultMode !== 'ledger') throw new TypeError('Invalid filesystem fault mode.');
  const originalWrite = filesystemDefault.writeFile;
  mock.method(filesystemDefault, 'writeFile', async (file: Parameters<typeof filesystemDefault.writeFile>[0], data: Parameters<typeof filesystemDefault.writeFile>[1], options?: Parameters<typeof filesystemDefault.writeFile>[2]) => {
      if (faultMode === 'ledger' && typeof file === 'string' && file.startsWith(join(partialChildRoot, 'output/share-image-cache/generated.json.')) && file.endsWith('.tmp')) {
        throw new Error('Simulated ownership ledger persistence failure.');
      }
      if (faultMode === 'partial' && file === join(partialChildRoot, 'dist/social/alpha.jpg')) {
        assert.ok(Buffer.isBuffer(data)); await originalWrite(file, data.subarray(0, 100));
        throw new Error('Simulated partial JPEG write failure.');
      }
      return originalWrite(file, data, options);
  });
  syncBuiltinESMExports();
}
const { shareCard, shareImageRecipeIdentity, writeShareImages } = await import('./share-images.mts');

const checkout = resolve(import.meta.dirname, '../..');
function objects(ids = ['alpha'], address = '/scenes/alpha/billboard.webp'): NonNullable<Parameters<typeof writeShareImages>[0]> {
  return ids.map(id => ({ id, discovery: { featured: false, imagery: true, illustration: false, arrival: {
    defaultDataset: 'normal', datasetIds: ['normal'], rotation: [0, 0, 0] as const,
    billboard: { dataset: 'normal', rotation: [0, 0, 0] as const, url: address, size: 1, focalPixels: 1, distanceM: 2 },
  } } }));
}

async function fixture(t: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'share-images-')); t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, bytes: string | Uint8Array) => {
    await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes);
  };
  // Real default recipe/pins; no supplied cache key, codec version or render recipe can bypass their collectors.
  for (const path of ['site/build/share-images.mts', 'package.json', 'pnpm-lock.yaml']) await put(path, await readFile(join(checkout, path)));
  await put('site/public/social/earth.jpg', 'canonical Earth capture');
  const billboard = Buffer.from('<svg width="32" height="20"><rect width="32" height="20" fill="#ff0000"/></svg>');
  await put('site/public/scenes/alpha/billboard.webp', billboard);
  const run = (ids = ['alpha'], address?: string) => writeShareImages(objects(ids, address), root);
  const cacheEntries = async () => (await readdir(join(root, 'output/share-image-cache'))).filter(name => /^[a-f0-9]{40}\.json$/u.test(name));
  return { root, put, billboard, run, cacheEntries };
}

// A separate process executes the same default writer against the prepared temporary checkout.
const childRoot = process.env.SHARE_IMAGES_TEST_CHILD_ROOT;
if (partialChildRoot !== undefined) {
  if (faultMode === 'ledger') {
    await assert.rejects(writeShareImages(objects(), partialChildRoot), /Simulated ownership ledger persistence failure/u);
    assert.ok((await readFile(join(partialChildRoot, 'dist/social/alpha.jpg'))).length > 100);
    console.log('LEDGER_PERSISTENCE_REJECTION_OK');
  } else {
    await assert.rejects(writeShareImages(objects(), partialChildRoot), /Simulated partial JPEG write failure/u);
    assert.equal((await readFile(join(partialChildRoot, 'dist/social/alpha.jpg'))).length, 100);
    assert.deepEqual(JSON.parse(await readFile(join(partialChildRoot, 'output/share-image-cache/generated.json'), 'utf8')), {
      schema: 'cssearth-generated-share-images@1', ids: ['alpha'],
    });
    console.log('PARTIAL_WRITE_OWNERSHIP_OK');
  }
} else if (childRoot !== undefined) {
  if (!childRoot || !join(childRoot, 'site/public').startsWith(tmpdir())) throw new TypeError('Invalid child fixture root.');
  console.log(JSON.stringify(await writeShareImages(objects(), childRoot)));
} else {
test('shareCard preserves the exact original transparent contain, centered black JPEG recipe', async () => {
  const input = await sharp({ create: { width: 21, height: 13, channels: 4, background: { r: 18, g: 80, b: 240, alpha: 0.4 } } }).png().toBuffer();
  const body = await sharp(input).resize(630, 630, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const expected = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#000' } })
    .composite([{ input: body, left: 285, top: 0 }]).jpeg({ quality: 40, mozjpeg: true }).toBuffer();
  assert.deepEqual(await shareCard(input), expected);
});

test('cold renders once, warm restores exact outputs after dist deletion in a fresh process', async t => {
  const { root, billboard, run } = await fixture(t);
  assert.deepEqual(await run(), { written: 1, rendered: 1, reused: 0, bytes: (await shareCard(billboard)).length });
  const expected = await readFile(join(root, 'dist/social/alpha.jpg'));
  await rm(join(root, 'dist'), { recursive: true });
  const { stdout } = await promisify(execFile)(process.execPath, [import.meta.filename], {
    cwd: checkout, env: { ...process.env, SHARE_IMAGES_TEST_CHILD_ROOT: root }, timeout: 30000,
  });
  const result: unknown = JSON.parse(stdout.trim());
  assert.deepEqual(result, { written: 1, rendered: 0, reused: 1, bytes: expected.length });
  assert.deepEqual(await readFile(join(root, 'dist/social/alpha.jpg')), expected);
  assert.equal(await readFile(join(root, 'dist/social/earth.jpg'), 'utf8'), 'canonical Earth capture');
});

test('same-length source bytes invalidate with unchanged mtime; identical owners share one cold render', async t => {
  const { root, put, billboard, run, cacheEntries } = await fixture(t);
  const first = await run(['alpha', 'beta']); assert.equal(first.rendered, 1); assert.equal(first.reused, 1);
  assert.equal((await cacheEntries()).length, 1);
  const before = await readFile(join(root, 'dist/social/alpha.jpg'));
  const path = join(root, 'site/public/scenes/alpha/billboard.webp'), info = await stat(path);
  const changed = Buffer.from(billboard.toString().replace('#ff0000', '#00ff00')); assert.equal(changed.length, billboard.length);
  await put('site/public/scenes/alpha/billboard.webp', changed); await utimes(path, info.atime, info.mtime);
  assert.equal((await run()).rendered, 1);
  assert.notDeepEqual(await readFile(join(root, 'dist/social/alpha.jpg')), before);
});

test('default recipe owner and real package pins invalidate; their deletion fails explicitly', async t => {
  const { root, put, run } = await fixture(t);
  await run(); let previous = await shareImageRecipeIdentity(root);
  for (const path of ['site/build/share-images.mts', 'package.json', 'pnpm-lock.yaml']) {
    const original = await readFile(join(root, path));
    await put(path, Buffer.concat([original, Buffer.from('\n')]));
    assert.notEqual(await shareImageRecipeIdentity(root), previous, path);
    assert.equal((await run()).rendered, 1, path); previous = await shareImageRecipeIdentity(root);
    await rm(join(root, path)); await assert.rejects(run(), /ENOENT/u, path); await put(path, original);
    assert.notEqual(await shareImageRecipeIdentity(root), previous, `${path} restoration`);
    previous = await shareImageRecipeIdentity(root);
  }
});

test('installed Sharp codec versions invalidate the default cache key', async t => {
  const { run } = await fixture(t); await run();
  const vips = sharp.versions.vips;
  try {
    Object.defineProperty(sharp.versions, 'vips', { value: `${vips}-changed` });
    assert.equal((await run()).rendered, 1);
  } finally { Object.defineProperty(sharp.versions, 'vips', { value: vips }); }
  assert.equal((await run()).rendered, 1);
});

test('actual process platform, architecture and Node version invalidate the default cache key', async t => {
  const { run } = await fixture(t); await run();
  for (const field of ['platform', 'arch', 'version'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(process, field); assert.ok(descriptor);
    try {
      Object.defineProperty(process, field, { value: `${process[field]}-changed` });
      assert.equal((await run()).rendered, 1, field);
    } finally { Object.defineProperty(process, field, descriptor); }
    assert.equal((await run()).rendered, 1, field);
  }
});

test('missing JPEG/receipt and corrupt bytes/receipt repair using the production integrity check', async t => {
  const { root, run, cacheEntries, put, billboard } = await fixture(t);
  await run(); const [receipt] = await cacheEntries(); assert.ok(receipt);
  const image = receipt.replace(/\.json$/u, '.jpg'), base = 'output/share-image-cache/';
  for (const path of [image, receipt]) {
    await rm(join(root, base, path)); assert.equal((await run()).rendered, 1, path);
  }
  const original = await readFile(join(root, base, image)), corrupted = Buffer.from(original); corrupted[corrupted.length - 1] ^= 1;
  await put(base + image, corrupted); assert.equal((await run()).rendered, 1);
  for (const bad of ['{', '{}', JSON.stringify({ schema: 'cssearth-share-card@1', key: receipt.slice(0, -5), bytes: original.length, cardBlob: '0'.repeat(40) })]) {
    await put(base + receipt, bad); assert.equal((await run()).rendered, 1);
  }
  assert.deepEqual(await readFile(join(root, 'dist/social/alpha.jpg')), await shareCard(billboard));
  assert.equal((await run()).reused, 1);
});

test('warm source read failures and unexpected cache filesystem failures remain failures', async t => {
  const { root, run, cacheEntries, put, billboard } = await fixture(t);
  await run(); await rm(join(root, 'site/public/scenes/alpha/billboard.webp'));
  await assert.rejects(run(), /1 share images failed/u);
  await mkdir(join(root, 'site/public/scenes/alpha/billboard.webp'));
  await assert.rejects(run(), /EISDIR/u);
  await rm(join(root, 'site/public/scenes/alpha/billboard.webp'), { recursive: true }); await put('site/public/scenes/alpha/billboard.webp', billboard);
  const [receipt] = await cacheEntries(); assert.ok(receipt);
  await rm(join(root, 'output/share-image-cache', receipt)); await mkdir(join(root, 'output/share-image-cache', receipt));
  await assert.rejects(run(), /EISDIR/u);
});

test('partial failed runs record only actual output attempts and later remove newly generated orphans', async t => {
  const { root, run, put } = await fixture(t); await run();
  await put('dist/social/unrelated.jpg', 'unmanaged JPEG'); await put('site/public/scenes/bad-y/bad.webp', 'unreadable image');
  await assert.rejects(writeShareImages([...objects(['new-x']), ...objects(['bad-y'], '/scenes/bad-y/bad.webp')], root), /1 share images failed/u);
  assert.ok((await readFile(join(root, 'dist/social/new-x.jpg'))).length > 0);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'output/share-image-cache/generated.json'), 'utf8')), {
    schema: 'cssearth-generated-share-images@1', ids: ['alpha', 'new-x'],
  });
  await run([]); await assert.rejects(readFile(join(root, 'dist/social/new-x.jpg')), /ENOENT/u);
  assert.equal(await readFile(join(root, 'dist/social/unrelated.jpg'), 'utf8'), 'unmanaged JPEG');
});

test('a partially failed JPEG write is owned before rejection and removed on a later successful run', async t => {
  const { root, run, put } = await fixture(t); await put('dist/social/unrelated.jpg', 'unmanaged JPEG');
  const { stdout } = await promisify(execFile)(process.execPath, [import.meta.filename], {
    cwd: checkout, env: { ...process.env, SHARE_IMAGES_TEST_PARTIAL_ROOT: root }, timeout: 30000,
  });
  assert.match(stdout, /PARTIAL_WRITE_OWNERSHIP_OK/u);
  await run([]); await assert.rejects(readFile(join(root, 'dist/social/alpha.jpg')), /ENOENT/u);
  assert.equal(await readFile(join(root, 'dist/social/unrelated.jpg'), 'utf8'), 'unmanaged JPEG');
});

test('malformed ledger JSON, schema, ids and read errors reject explicitly', async t => {
  const { root, run, put } = await fixture(t);
  for (const invalid of ['{', '{}', JSON.stringify({ schema: 'wrong', ids: [] }), JSON.stringify({ schema: 'cssearth-generated-share-images@1', ids: ['../escape'] }), JSON.stringify({ schema: 'cssearth-generated-share-images@1', ids: [1] })]) {
    await put('output/share-image-cache/generated.json', invalid); await assert.rejects(run(), /SyntaxError|Invalid generated share-image ledger/u);
  }
  await rm(join(root, 'output/share-image-cache/generated.json'));
  await run(); await rm(join(root, 'output/share-image-cache/generated.json')); await mkdir(join(root, 'output/share-image-cache/generated.json'));
  await assert.rejects(run(), /EISDIR/u);
});

test('ownership checkpoint persistence failure rejects after the actual generated output write', async t => {
  const { root } = await fixture(t);
  const { stdout } = await promisify(execFile)(process.execPath, [import.meta.filename], {
    cwd: checkout, env: { ...process.env, SHARE_IMAGES_TEST_PARTIAL_ROOT: root, SHARE_IMAGES_TEST_FAULT_MODE: 'ledger' }, timeout: 30000,
  });
  assert.match(stdout, /LEDGER_PERSISTENCE_REJECTION_OK/u);
});

test('additions/removals and committed-capture transitions sync only managed generated outputs', async t => {
  const { root, run, put, billboard } = await fixture(t);
  await put('dist/social/unrelated.jpg', 'unmanaged public capture');
  await run(['alpha', 'beta']);
  await run(['alpha']); await assert.rejects(readFile(join(root, 'dist/social/beta.jpg')), /ENOENT/u);
  await put('site/public/social/alpha.jpg', 'new canonical alpha capture');
  assert.equal((await run()).written, 0);
  assert.equal(await readFile(join(root, 'dist/social/alpha.jpg'), 'utf8'), 'new canonical alpha capture');
  await put('site/public/social/alpha.jpg', 'changed canonical alpha capture'); await run();
  assert.equal(await readFile(join(root, 'dist/social/alpha.jpg'), 'utf8'), 'changed canonical alpha capture');
  await rm(join(root, 'site/public/social/alpha.jpg')); assert.equal((await run()).rendered, 1);
  assert.deepEqual(await readFile(join(root, 'dist/social/alpha.jpg')), await shareCard(billboard));
  await run([]); await assert.rejects(readFile(join(root, 'dist/social/alpha.jpg')), /ENOENT/u);
  assert.equal(await readFile(join(root, 'dist/social/unrelated.jpg'), 'utf8'), 'unmanaged public capture');
});

test('successful ledger compaction retires removed and captured IDs so later unmanaged JPEGs survive', async t => {
  const { root, run, put } = await fixture(t);
  const ledger = async (): Promise<unknown> => JSON.parse(await readFile(join(root, 'output/share-image-cache/generated.json'), 'utf8'));
  await run(['alpha', 'beta']);
  assert.deepEqual(await ledger(), { schema: 'cssearth-generated-share-images@1', ids: ['alpha', 'beta'] });
  await run(['alpha']);
  assert.deepEqual(await ledger(), { schema: 'cssearth-generated-share-images@1', ids: ['alpha'] });
  await put('dist/social/beta.jpg', 'new unmanaged JPEG after beta retired');
  await run(['alpha']);
  assert.equal(await readFile(join(root, 'dist/social/beta.jpg'), 'utf8'), 'new unmanaged JPEG after beta retired');
  await put('site/public/social/alpha.jpg', 'canonical capture after alpha retired');
  await run(['alpha']);
  assert.deepEqual(await ledger(), { schema: 'cssearth-generated-share-images@1', ids: [] });
  await run([]);
  assert.deepEqual(await ledger(), { schema: 'cssearth-generated-share-images@1', ids: [] });
  assert.equal(await readFile(join(root, 'dist/social/beta.jpg'), 'utf8'), 'new unmanaged JPEG after beta retired');
});

test('successful runs retain only active canonical pairs and preserve unexpected or partial files', async t => {
  const { root, put, run, billboard, cacheEntries } = await fixture(t);
  await run(); const [old] = await cacheEntries(); assert.ok(old);
  const base = 'output/share-image-cache/', partial = `${'f'.repeat(40)}.jpg`;
  await put(base + 'unrelated.jpg', 'unexpected JPEG'); await put(base + partial, 'partial cache entry');
  await mkdir(join(root, base, `${'e'.repeat(40)}.jpg`)); await put(base + `${'e'.repeat(40)}.json`, '{}');
  await put('site/public/scenes/alpha/billboard.webp', Buffer.from(billboard.toString().replace('#ff0000', '#00ff00')));
  assert.equal((await run()).rendered, 1);
  await assert.rejects(readFile(join(root, base, old)), /ENOENT/u);
  await assert.rejects(readFile(join(root, base, old.replace(/\.json$/u, '.jpg'))), /ENOENT/u);
  assert.equal((await cacheEntries()).filter(name => name !== `${'e'.repeat(40)}.json`).length, 1);
  assert.equal(await readFile(join(root, base, 'unrelated.jpg'), 'utf8'), 'unexpected JPEG');
  assert.equal(await readFile(join(root, base, partial), 'utf8'), 'partial cache entry');
  assert.ok((await stat(join(root, base, `${'e'.repeat(40)}.jpg`))).isDirectory());
  assert.equal((await run()).reused, 1);
  await rm(join(root, 'site/public/scenes/alpha/billboard.webp'));
  await assert.rejects(run(), /1 share images failed/u);
  assert.equal((await cacheEntries()).filter(name => name !== `${'e'.repeat(40)}.json`).length, 1);
});

test('actual remote bytes are fetched even on warm reuse; failure retains three retries', async t => {
  const { billboard, run } = await fixture(t); let requests = 0, failing = false, current = billboard;
  const server = createServer((_request, response) => { requests++; response.statusCode = failing ? 503 : 200; response.end(current); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/billboard.webp`;
  assert.equal((await run(['alpha'], url)).rendered, 1); assert.equal((await run(['alpha'], url)).reused, 1); assert.equal(requests, 2);
  current = Buffer.from(billboard.toString().replace('#ff0000', '#0000ff'));
  assert.equal((await run(['alpha'], url)).rendered, 1); assert.equal(requests, 3);
  failing = true; await assert.rejects(run(['alpha'], url), /HTTP 503/u); assert.equal(requests, 6);
});
}
