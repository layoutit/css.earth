import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { preparedJsonImports, collectTypecheckPreparedImports, typecheckAssetsForPaths, typecheckFeatureAssets } from './prepare-typecheck.mts';
import { installRuntimeAssets } from '../assets/setup.mts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-typecheck-inputs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  return { root, write };
}

test('literal import, export and import-type inputs are discovered; data paths and comments are not', () => {
  const root = resolve('/fixture'), file = resolve(root, 'tests/check.mts');
  assert.deepEqual(preparedJsonImports(file, `
    import input from '../../src/objects/body/prepared/runtime.json' with { type: 'json' };
    export { default } from '../../src/objects/body/prepared/scene.json';
    const dynamic = import('../../src/objects/body/prepared/page.json');
    type Data = typeof import('../../src/objects/body/prepared/content.json');
    // import x from '../../src/objects/body/prepared/not-imported.json';
    const path = '../src/objects/body/prepared/also-not-imported.json';
  `, root), ['content', 'page', 'runtime', 'scene'].map(name => resolve(root, `src/objects/body/prepared/${name}.json`)));
});

test('Astro frontmatter and inline module imports also join the real prepared input closure', () => {
  const root = resolve('/fixture'), file = resolve(root, 'site/view.astro');
  assert.deepEqual(preparedJsonImports(file, `---
import data from '../../src/objects/body/prepared/content.json';
---
<script>import('../../src/objects/body/prepared/page.json');</script>`, root),
  ['content', 'page'].map(name => resolve(root, `src/objects/body/prepared/${name}.json`)));
});

test('a new maintained test import is discovered without adding its body to a list', async t => {
  const { root, write } = await fixture(t);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await write('.gitignore', 'ignored/\n');
  await write('tests/future.test.mts', `import data from '../../src/objects/new-body/prepared/runtime.json';`);
  await write('ignored/generated.ts', `import data from '../../src/objects/unrelated/prepared/runtime.json';`);
  assert.deepEqual(await collectTypecheckPreparedImports(root), [resolve(root, 'src/objects/new-body/prepared/runtime.json')]);
});

test('only imported pinned JSON is restored; an unrelated missing texture never gets requested', async t => {
  const { root, write } = await fixture(t);
  const bytes = Buffer.from('{"actual":"prepared data"}'), sha256 = createHash('sha256').update(bytes).digest('hex');
  await write('src/objects/body/inventory.json', {
    schema: 'cssearth-inventory@1', assets: [
      { filename: 'runtime.json', bytes: bytes.length, sha256 },
      { filename: 'unrelated.webp', bytes: 123, sha256: '0'.repeat(64) },
    ],
  });
  const path = resolve(root, 'src/objects/body/prepared/runtime.json');
  const assets = await typecheckAssetsForPaths([path], root), requested: string[] = [];
  assert.equal(assets.length, 1);
  await installRuntimeAssets(assets, { fetcher: async url => { requested.push(String(url)); return new Response(bytes); } });
  assert.deepEqual(requested, [`https://earth-assets.lowpoly.cc/runtime-assets/${sha256}/runtime.json`]);
  assert.deepEqual(await readFile(path), bytes);
  await write('src/objects/body/prepared/runtime.json', 'corrupt');
  await assert.rejects(installRuntimeAssets(assets, { fetcher: async () => new Response('wrong bytes') }), /identity|expected|SHA|digest|size|bytes|length/iu);
});

test('a missing JSON input without an inventory fails; paths outside object preparation are rejected', async t => {
  const { root } = await fixture(t);
  await assert.rejects(typecheckAssetsForPaths([resolve(root, 'src/objects/body/prepared/runtime.json')], root), /ENOENT/);
  await assert.rejects(typecheckAssetsForPaths([resolve(root, '../outside.json')], root), /outside/);
});

test('feature-index preparation selects pinned catalogues and banks, rejecting drift without restoring textures', async t => {
  const { root, write } = await fixture(t);
  const pin = { url: '/scenes/body/features.json', bytes: 20, sha256: '1'.repeat(64) };
  const bank = { url: '/scenes/body/bank-00.json', bytes: 30, sha256: '2'.repeat(64) };
  const descriptor = { schema: 'cssearth-prepared-features@1', ...pin, selection: { banks: [bank] } };
  await write('src/objects/body/prepared/features.json', descriptor);
  await write('src/objects/body/inventory.json', { schema: 'cssearth-inventory@1', assets: [
    { filename: 'features.json', bytes: pin.bytes, sha256: pin.sha256 },
    { filename: 'bank-00.json', bytes: bank.bytes, sha256: bank.sha256 },
    { filename: 'surface.webp', bytes: 999, sha256: '3'.repeat(64) },
  ] });
  const selected = await typecheckFeatureAssets(root, ['body']);
  assert.deepEqual(selected.assets.map(asset => asset.filename), ['bank-00.json', 'features.json']);
  assert.deepEqual(selected.catalogues.map(asset => asset.filename), ['features.json']);
  await write('src/objects/body/prepared/features.json', { ...descriptor, sha256: '0'.repeat(64) });
  await assert.rejects(typecheckFeatureAssets(root, ['body']), /descriptor and inventory/);
});
