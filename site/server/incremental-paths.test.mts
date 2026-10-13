import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { gitBlobIdentity, incrementalPaths, IncrementalPathInputs } from './incremental-paths.mts';
import { resolveSceneAddressesDeep, resolveWorldBillboards, rewriteSceneCss, sceneCssInputs } from '../server-assets/asset-origin.mts';
import { splitPreparedRuntimeText } from '@cssearth/objects/node';
import { projectRoot } from '@cssearth/core/node';

async function fixture(t: { after(callback: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'incremental-inputs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, text: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  };
  for (const id of ['alpha', 'beta']) {
    await put(`src/objects/${id}/object.json`, JSON.stringify({ id }));
    await put(`src/objects/${id}/README.md`, 'Sources');
    await put(`src/objects/${id}/prepared/runtime.json`, JSON.stringify({ id, measured: 1 }));
  }
  await put('site/public/social/earth.jpg', 'fallback image');
  await put('src/objects/README.md', 'Shared object guide');
  await put('packages/README.md', 'Shared package guide');
  const key = (id: string, env: NodeJS.ProcessEnv = {}) => new IncrementalPathInputs(root, env).key({ params: { id } });
  return { root, put, key };
}

test('file identity is exactly Git blob identity', () => {
  const bytes = Buffer.from('published bytes\n');
  assert.equal(gitBlobIdentity(bytes), execFileSync('git', ['hash-object', '--stdin'], { input: bytes, encoding: 'utf8' }).trim());
});

test('default route helper performs no snapshot and preserves paths', async () => {
  const before = process.env.CSSEARTH_INCREMENTAL_BUILD;
  delete process.env.CSSEARTH_INCREMENTAL_BUILD;
  try {
    const paths = [{ params: { id: 'no-such-object' } }];
    assert.equal(await incrementalPaths(paths), paths);
  } finally {
    if (before === undefined) delete process.env.CSSEARTH_INCREMENTAL_BUILD;
    else process.env.CSSEARTH_INCREMENTAL_BUILD = before;
  }
});

test('actual runtime bytes invalidate their owner even when timestamps and lengths match', async t => {
  const { root, put, key } = await fixture(t);
  const a = await key('alpha'), b = await key('beta');
  const path = join(root, 'src/objects/alpha/prepared/runtime.json'), info = await stat(path);
  await put('src/objects/alpha/prepared/runtime.json', '{"id":"alpha","measured":2}');
  await utimes(path, info.atime, info.mtime);
  assert.notEqual(await key('alpha'), a);
  assert.equal(await key('beta'), b);
});

test('missing optional inputs, README deletion, and owner social images invalidate correctly', async t => {
  const { root, put, key } = await fixture(t);
  const original = await key('alpha'), sibling = await key('beta');
  for (const path of ['src/objects/alpha/source/presentation/overview.json', 'site/public/social/alpha.jpg']) {
    await put(path, '{}');
    assert.notEqual(await key('alpha'), original, path);
    assert.equal(await key('beta'), sibling, path);
    await rm(join(root, path));
    // Directory presence is also an input; remove the newly created optional directory for the matched baseline.
    if (path.includes('/source/')) await rm(join(root, 'src/objects/alpha/source'), { recursive: true });
    assert.equal(await key('alpha'), original, path);
  }
  await rm(join(root, 'src/objects/alpha/README.md'));
  assert.notEqual(await key('alpha'), original);
});

test('referenced bank bytes and explicit orbit holder bytes belong to the closure', async t => {
  const { root, put, key } = await fixture(t);
  await put('src/objects/alpha/prepared/runtime.json', '{"volume":{"objectId":"bank"}}');
  await put('src/objects/bank/prepared/runtime.json', '{}');
  const original = await key('alpha'), sibling = await key('beta');
  await put('src/objects/bank/prepared/runtime.json', '{"measured":2}');
  assert.notEqual(await key('alpha'), original);
  assert.equal(await key('beta'), sibling);
  const orbit = () => new IncrementalPathInputs(root, {}).key({ params: { id: 'beta' } }, ['alpha']);
  const prior = await orbit();
  await put('src/objects/alpha/prepared/orbits/beta.bin', 'real bank bytes');
  assert.notEqual(await orbit(), prior);
});

test('shared filesystem world flags, function-valued plugin code, and external package code invalidate', async t => {
  const { put, key } = await fixture(t);
  for (const path of ['src/objects/beta/prepared/members.json', 'site/build/plugin.mts', 'packages/renderer/dist/index.js', 'site/source/source-icons.json']) {
    const original = await key('alpha');
    await put(path, '{"anywhere":true}');
    assert.notEqual(await key('alpha'), original, path);
  }
});

test('asset origin changes key; deployment revision alone leaves reusable data identity stable', async t => {
  const { key } = await fixture(t);
  const original = await key('alpha', { ASSET_ORIGIN: 'https://assets.example', COMMIT_REF: 'first' });
  assert.equal(await key('alpha', { ASSET_ORIGIN: 'https://assets.example', COMMIT_REF: 'second' }), original);
  assert.notEqual(await key('alpha', { ASSET_ORIGIN: 'https://other.example' }), original);
});

test('owner public image bytes and missing runtime cache input cannot retain the old key', async t => {
  const { root, put, key } = await fixture(t);
  await put('site/public/scenes/alpha/arrival.webp', 'a');
  const original = await key('alpha');
  await put('site/public/scenes/alpha/arrival.webp', 'b');
  assert.notEqual(await key('alpha'), original);
  const next = await key('alpha');
  await rm(join(root, 'src/objects/alpha/prepared/runtime.json'));
  assert.notEqual(await key('alpha'), next);
  assert.equal(await readFile(join(root, 'site/public/scenes/alpha/arrival.webp'), 'utf8'), 'b');
});

test('only republishing an implicitly addressed child billboard invalidates its unchanged holder response', async t => {
  const { root, put } = await fixture(t);
  const origin = 'https://assets.example', priorOrigin = process.env.ASSET_ORIGIN;
  process.env.ASSET_ORIGIN = origin;
  t.after(() => { if (priorOrigin === undefined) delete process.env.ASSET_ORIGIN; else process.env.ASSET_ORIGIN = priorOrigin; });
  const world = JSON.stringify({ bodies: { id: ['beta', 'dot', 'bare'], billboard: [{}, {}, null], plainDot: [null, true, null] } });
  await put('src/objects/alpha/prepared/members.json', world);
  const inventory = (letter: string) => JSON.stringify({ schema: 'cssearth-inventory@1', assets: [
    { location: 'public', filename: 'beta-billboard.webp', bytes: 1, sha256: letter.repeat(64) },
  ] });
  await put('src/objects/beta/inventory.json', inventory('a'));
  const env = { ASSET_ORIGIN: origin }, path = { params: { id: 'alpha' } };
  const firstKey = await new IncrementalPathInputs(root, env).key(path);
  const firstResponse = await resolveWorldBillboards(world, root);
  const nextRoot = await mkdtemp(join(tmpdir(), 'incremental-republished-'));
  t.after(() => rm(nextRoot, { recursive: true, force: true }));
  await cp(root, nextRoot, { recursive: true });
  assert.equal(await new IncrementalPathInputs(nextRoot, env).key(path), firstKey);
  // A new process/root gets the next build's fresh inventory cache. No holder, runtime, or catalogue input changes.
  await writeFile(join(nextRoot, 'src/objects/beta/inventory.json'), inventory('b'));
  const nextKey = await new IncrementalPathInputs(nextRoot, env).key(path);
  assert.notEqual(nextKey, firstKey);
  const fresh = await resolveWorldBillboards(world, nextRoot);
  const reusedOrFresh = nextKey === firstKey ? firstResponse : fresh;
  assert.equal(reusedOrFresh, fresh);
  assert.equal(JSON.parse(fresh).bodies.billboard[0].url, `${origin}/runtime-assets/${'b'.repeat(64)}/beta-billboard.webp`);
  assert.notEqual(fresh, firstResponse);
  assert.equal(await readFile(join(nextRoot, 'src/objects/alpha/prepared/members.json'), 'utf8'), world);
});

test('decoded escaped slash addresses and unicode owner fields retain external byte dependencies', async t => {
  const { root, put } = await fixture(t);
  const priorOrigin = process.env.ASSET_ORIGIN, origin = 'https://assets.example';
  process.env.ASSET_ORIGIN = origin;
  t.after(() => { if (priorOrigin === undefined) delete process.env.ASSET_ORIGIN; else process.env.ASSET_ORIGIN = priorOrigin; });
  const authored = String.raw`{"volume":{"\u006fbjectId":"\u0075nicode-bank"},"thumbnail":"\/scenes\/beta\/picture.webp"}`;
  await put('src/objects/alpha/source/content/object.json', authored);
  await put('src/objects/unicode-bank/prepared/runtime.json', '{"measured":1}');
  const inventory = (letter: string) => JSON.stringify({ schema: 'cssearth-inventory@1', assets: [
    { location: 'public', filename: 'picture.webp', bytes: 1, sha256: letter.repeat(64) },
  ] });
  await put('src/objects/beta/inventory.json', inventory('a'));
  const path = { params: { id: 'alpha' } }, env = { ASSET_ORIGIN: origin };
  const firstKey = await new IncrementalPathInputs(root, env).key(path);
  const firstResponse = await resolveSceneAddressesDeep(JSON.parse(authored), root);
  const nextRoot = await mkdtemp(join(tmpdir(), 'incremental-escaped-'));
  t.after(() => rm(nextRoot, { recursive: true, force: true }));
  await cp(root, nextRoot, { recursive: true });
  assert.equal(await new IncrementalPathInputs(nextRoot, env).key(path), firstKey);
  await writeFile(join(nextRoot, 'src/objects/beta/inventory.json'), inventory('b'));
  const nextKey = await new IncrementalPathInputs(nextRoot, env).key(path);
  assert.notEqual(nextKey, firstKey, 'escaped external image owner must invalidate');
  const fresh = await resolveSceneAddressesDeep(JSON.parse(authored), nextRoot);
  assert.notDeepEqual(fresh, firstResponse);
  assert.equal(fresh.thumbnail, `${origin}/runtime-assets/${'b'.repeat(64)}/picture.webp`);
  const nextDataKey = await new IncrementalPathInputs(nextRoot, env).key(path);
  await writeFile(join(nextRoot, 'src/objects/unicode-bank/prepared/runtime.json'), '{"measured":2}');
  assert.notEqual(await new IncrementalPathInputs(nextRoot, env).key(path), nextDataKey, 'unicode objectId owner must invalidate');
  assert.equal(await readFile(join(nextRoot, 'src/objects/alpha/source/content/object.json'), 'utf8'), authored);
});

test('stored runtime profiles use the canonical reader and refuse a missing referenced profile', async t => {
  const { root, put, key } = await fixture(t);
  const baked = JSON.stringify({ id: 'alpha', viewBindings: [{ kind: 'silhouette-step-property', boxes: [{ node: 1, box: [1, 2] }] }] });
  const split = splitPreparedRuntimeText(baked);
  assert.ok(split);
  await put('src/objects/alpha/prepared/runtime.json', split.runtime);
  await put('src/objects/alpha/prepared/leaf-boxes.json', split.leafBoxes);
  const original = await key('alpha');
  await put('src/objects/alpha/prepared/leaf-boxes.json', '[{"node":1,"box":[2,3]}]\n');
  assert.notEqual(await key('alpha'), original, 'the profile bytes are part of the key');
  await rm(join(root, 'src/objects/alpha/prepared/leaf-boxes.json'));
  await assert.rejects(key('alpha'), error => error instanceof Error && 'code' in error && error.code === 'ENOENT',
    'missing referenced profile must stop reuse rather than interpreting stored runtime directly');
});

test('shared authored CSS inventory changes invalidate the actual consuming page and missing CSS refuses reuse', async t => {
  const { root, put } = await fixture(t);
  const priorOrigin = process.env.ASSET_ORIGIN, origin = 'https://assets.example';
  process.env.ASSET_ORIGIN = origin;
  t.after(() => { if (priorOrigin === undefined) delete process.env.ASSET_ORIGIN; else process.env.ASSET_ORIGIN = priorOrigin; });
  const cssPath = 'src/renderers/css/styles/body-surfaces.css';
  const css = await readFile(join(projectRoot(import.meta.url), cssPath), 'utf8');
  const filenames = new Map<string, Set<string>>();
  for (const { owner, address } of sceneCssInputs(css)) {
    const files = filenames.get(owner) ?? new Set<string>();
    files.add(address.slice(`/scenes/${owner}/`.length));
    filenames.set(owner, files);
  }
  assert.deepEqual([...filenames.keys()].sort(), ['mars', 'venus']);
  const inventory = (files: ReadonlySet<string>, letter: string) => JSON.stringify({ schema: 'cssearth-inventory@1', assets: [...files].map(filename =>
    ({ location: 'public', filename, bytes: 1, sha256: letter.repeat(64) })) });
  await put(cssPath, css);
  await put('site/layouts/object-shell.css', '/* shared shell without scene addresses */');
  await put('src/objects/mars/object.json', JSON.stringify({ id: 'mars', properties: { page: { stylesheets: [cssPath] } } }));
  await put('src/objects/mars/prepared/runtime.json', '{}');
  for (const [owner, files] of filenames) await put(`src/objects/${owner}/inventory.json`, inventory(files, 'a'));
  const env = { ASSET_ORIGIN: origin }, path = { params: { id: 'mars' } };
  const original = await new IncrementalPathInputs(root, env).key(path);
  const oldCss = await rewriteSceneCss(css, root);
  const changedCss = `${css}\n.mars { opacity: .99; }\n`;
  await put(cssPath, changedCss);
  assert.notEqual(await new IncrementalPathInputs(root, env).key(path), original, 'stylesheet bytes change the key with identical scene addresses');
  assert.notEqual(await rewriteSceneCss(changedCss, root), oldCss, 'changed stylesheet bytes reach the consumer');
  await put(cssPath, css);
  assert.equal(await new IncrementalPathInputs(root, env).key(path), original);
  const renamedPath = 'src/renderers/css/styles/renamed-body-surfaces.css';
  await put(renamedPath, css);
  await put('src/objects/mars/object.json', JSON.stringify({ id: 'mars', properties: { page: { stylesheets: [renamedPath] } } }));
  assert.notEqual(await new IncrementalPathInputs(root, env).key(path), original, 'a same-byte stylesheet path change remains an input');
  await put('src/objects/mars/object.json', JSON.stringify({ id: 'mars', properties: { page: { stylesheets: [cssPath] } } }));
  await rm(join(root, renamedPath));
  assert.equal(await new IncrementalPathInputs(root, env).key(path), original);
  const nextRoot = await mkdtemp(join(tmpdir(), 'incremental-css-'));
  t.after(() => rm(nextRoot, { recursive: true, force: true }));
  await cp(root, nextRoot, { recursive: true });
  assert.equal(await new IncrementalPathInputs(nextRoot, env).key(path), original);
  const venusFiles = filenames.get('venus');
  assert.ok(venusFiles);
  await writeFile(join(nextRoot, 'src/objects/venus/inventory.json'), inventory(venusFiles, 'b'));
  const nextKey = await new IncrementalPathInputs(nextRoot, env).key(path);
  assert.notEqual(nextKey, original, 'the unchanged Mars stylesheet consumes the changed Venus inventory');
  const freshCss = await rewriteSceneCss(css, nextRoot);
  assert.notEqual(freshCss, oldCss);
  assert.equal(nextKey === original ? oldCss : freshCss, freshCss);
  // A stylesheet rewrite never consumes the other owner's runtime or unrelated authoring data.
  await mkdir(join(nextRoot, 'src/objects/venus/prepared'), { recursive: true });
  await writeFile(join(nextRoot, 'src/objects/venus/prepared/runtime.json'), '{"unrelated":true}');
  assert.equal(await new IncrementalPathInputs(nextRoot, env).key(path), nextKey);
  await rm(join(nextRoot, cssPath));
  await assert.rejects(new IncrementalPathInputs(nextRoot, env).key(path), error => error instanceof Error && 'code' in error && error.code === 'ENOENT');
});
