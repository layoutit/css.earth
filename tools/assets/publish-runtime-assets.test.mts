import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { contentType, publishAssets } from './publish-runtime-assets.mts';
import type { PublishAsset } from './publish-verification.mts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-publisher-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('right');
  const assets: PublishAsset[] = Array.from({ length: 11 }, (_, index) => {
    const key = `file-${String(index).padStart(2, '0')}.bin`;
    return { key, file: join(root, key), bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  const victim = assets.at(-1)!; // Outside the default ten-binary byte sample.
  const heads = new Map<string, number>();
  let transientFailure = false;
  let absent = false;
  const uploads: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const key = new URL(input instanceof Request ? input.url : String(input)).pathname.slice(1);
    if (init?.method === 'HEAD') {
      const count = (heads.get(key) ?? 0) + 1;
      heads.set(key, count);
      if (key === victim.key && (absent || (transientFailure && count === 2))) {
        return new Response(null, { status: absent ? 404 : 503 });
      }
      return new Response(null, { headers: { 'content-type': contentType(key), 'content-length': String(bytes.length) } });
    }
    return new Response(bytes);
  };
  const runCommand = async (command: string, args: readonly string[]) => {
    assert.equal(command, 'npx');
    if (args.includes('bulk')) {
      const filename = args[args.indexOf('--filename') + 1];
      assert.ok(filename);
      assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), [{ key: victim.key, file: victim.file }]);
    } else {
      assert.ok(args.includes('object'));
      assert.equal(args[args.indexOf('--file') + 1], victim.file);
    }
    assert.deepEqual(await readFile(victim.file), bytes, 'only pinned bytes may reach the upload command');
    uploads.push(victim.key);
    absent = false;
  };
  return { assets, victim, bytes, heads, uploads, options: { fetcher, runCommand },
    failLaterHead: () => { transientFailure = true; }, markAbsent: () => { absent = true; } };
}

test('JSON keys publish as application/json; every other key stays application/octet-stream', () => {
  assert.equal(contentType('runtime-assets/abc123/scene.json'), 'application/json');
  assert.equal(contentType('runtime-assets/abc123/inventory.json'), 'application/json');
  assert.equal(contentType('runtime-assets/abc123/atlas.webp'), 'application/octet-stream');
  assert.equal(contentType('runtime-assets/abc123/model.jsonl'), 'application/octet-stream');
});

test('a later HEAD failure cannot upload corrupt bytes for a previously live, unsampled key', async t => {
  const f = await fixture(t);
  await writeFile(f.victim.file, 'wrong'); // Same length: the hash must be checked.
  f.failLaterHead();
  await assert.rejects(publishAssets(f.assets, f.options), /local bytes do not match the inventory/);
  assert.equal(f.heads.get(f.victim.key), 2);
  assert.deepEqual(f.uploads, []);
});

test('a partial checkout needs no local bytes for live assets', async t => {
  const f = await fixture(t);
  await publishAssets(f.assets, f.options);
  assert.deepEqual(f.uploads, []);
});

test('a retry requires its local input and never launches an upload when it is missing', async t => {
  const f = await fixture(t);
  f.failLaterHead();
  await assert.rejects(publishAssets(f.assets, f.options), { code: 'ENOENT' });
  assert.deepEqual(f.uploads, []);
});

test('a later HEAD failure can upload a valid local asset without restoring the other live assets', async t => {
  const f = await fixture(t);
  await writeFile(f.victim.file, f.bytes);
  f.failLaterHead();
  await publishAssets(f.assets, f.options);
  assert.deepEqual(f.uploads, [f.victim.key]);
});

test('the bulk path rejects a corrupt initial miss, then accepts its pinned bytes', async t => {
  const f = await fixture(t);
  f.markAbsent();
  await writeFile(f.victim.file, 'wrong');
  await assert.rejects(publishAssets(f.assets, f.options), /local bytes do not match the inventory/);
  assert.deepEqual(f.uploads, []);
  await writeFile(f.victim.file, f.bytes);
  await publishAssets(f.assets, f.options);
  assert.deepEqual(f.uploads, [f.victim.key]);
});

test('a bulk retry rechecks bytes changed after the first upload attempt', async t => {
  const f = await fixture(t);
  await writeFile(f.victim.file, f.bytes);
  f.markAbsent();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let attempts = 0;
  await assert.rejects(publishAssets(f.assets, { ...f.options, runCommand: async () => {
    attempts++;
    if (attempts !== 1) throw new Error('Unchecked bytes reached a second upload');
    await writeFile(f.victim.file, 'wrong');
    // Let the rejected upload schedule its backoff, then advance the native mock clock.
    setImmediate(() => t.mock.timers.tick(3000));
    throw new Error('Transient upload failure');
  } }), /local bytes do not match the inventory/);
  assert.equal(attempts, 1);
});
