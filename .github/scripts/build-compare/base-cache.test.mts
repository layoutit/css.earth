/** Real file manifests and real source mutants: every invalid cache takes the fresh path. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cacheKey, sealCache, useCache, validateCache, packCache, unpackCache, type CacheIdentity } from './base-cache.mts';
const identity: CacheIdentity = { commit: 'a'.repeat(40), toolchain: { node: process.version, pnpm: '10' }, lockfile: Buffer.from('lock') };
async function fixture(root: string) {
  const data: Record<string, string> = { 'base/dist/index.html': 'page', 'base/metadata/client.json': '{}', 'base/inventories/body.json': '{}', 'base/toolchain.json': JSON.stringify(identity.toolchain), 'base/pnpm-lock.yaml': 'lock', 'base/build.json': '{}', 'performance/base/measures.json': '{}', 'performance/base.md': 'measures' };
  for (const target of ['preview', 'cloudflare']) {
    data[`server-answers/base/${target}/index.json`] = JSON.stringify({ schema: 3, target, requests: ['one'] });
    data[`server-answers/base/${target}/one.json`] = '{}';
  }
  for (const [path, value] of Object.entries(data)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), value); }
  await sealCache(root, identity);
}
async function contract(consume: typeof useCache) {
  const root = await mkdtemp(join(tmpdir(), 'base-cache-contract-'));
  try {
    for (const change of ['round-trip', 'missing-file', 'wrong-length', 'wrong-md5', 'wrong-toolchain', 'wrong-lockfile', 'wrong-commit', 'missing-manifest', 'incomplete-manifest']) {
      const payload = join(root, change); await fixture(payload);
      let expected = identity;
      if (change === 'missing-file') await rm(join(payload, 'base/dist/index.html'));
      if (change === 'wrong-length') await writeFile(join(payload, 'base/dist/index.html'), 'longer page');
      if (change === 'wrong-md5') await writeFile(join(payload, 'base/dist/index.html'), 'PAGE');
      if (change === 'wrong-toolchain') expected = { ...identity, toolchain: { node: 'wrong' } };
      if (change === 'wrong-lockfile') expected = { ...identity, lockfile: Buffer.from('LOCK') };
      if (change === 'wrong-commit') expected = { ...identity, commit: 'b'.repeat(40) };
      if (change === 'missing-manifest') await rm(join(payload, 'validity.json'));
      if (change === 'incomplete-manifest') {
        const manifest = JSON.parse(await readFile(join(payload, 'validity.json'), 'utf8'));
        manifest.files.pop(); await writeFile(join(payload, 'validity.json'), JSON.stringify(manifest));
      }
      let fresh = 0;
      const out = join(root, `${change}-out`);
      const result = await consume(payload, out, expected, async () => { fresh++; await mkdir(out, { recursive: true }); await writeFile(join(out, 'fresh'), 'positive fallback'); });
      assert.equal(result.hit, change === 'round-trip', change);
      assert.equal(fresh, change === 'round-trip' ? 0 : 1, `${change}: fallback actually ran`);
      if (result.hit) assert.equal(await readFile(join(out, 'base/dist/index.html'), 'utf8'), 'page');
      else assert.equal(await readFile(join(out, 'fresh'), 'utf8'), 'positive fallback');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('commit key and fail-closed round trips', async () => {
  assert.equal(cacheKey(identity.commit), `site-base-v1-${identity.commit}`);
  for (const commit of ['', '../escape', 'A'.repeat(40)]) assert.throws(() => cacheKey(commit));
  await contract(useCache);
});
test('compressed archive round trip measures actual bytes and validates them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'base-cache-archive-'));
  try {
    await fixture(join(root, 'input'));
    const bytes = await packCache(join(root, 'input'), join(root, 'base.tgz'));
    assert.equal(bytes, (await readFile(join(root, 'base.tgz'))).length); assert.ok(bytes > 0);
    await unpackCache(join(root, 'base.tgz'), join(root, 'unpacked'));
    await validateCache(join(root, 'unpacked'), identity);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('wrong-commit, bypass-integrity and dropped-fallback source mutations each turn the contract red', async () => {
  const root = await mkdtemp(join(tmpdir(), 'base-cache-mutants-'));
  try {
    await copyFile(new URL('./records.mts', import.meta.url), join(root, 'records.mts'));
    const source = await readFile(new URL('./base-cache.mts', import.meta.url), 'utf8');
    const mutations = [
      ['manifest.schema !== 1 || manifest.commit !== identity.commit', 'manifest.schema !== 1'],
      ['await validateCache(root, identity);', '// integrity deleted'],
      ['await fresh();', '// fallback deleted'],
    ];
    for (const [index, pair] of mutations.entries()) {
      assert.ok(source.includes(pair[0]!)); const path = join(root, `mutant-${index}.mts`);
      await writeFile(path, source.replace(pair[0]!, pair[1]!));
      const mutant = await import(pathToFileURL(path).href);
      await assert.rejects(contract(mutant.useCache), assert.AssertionError);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
