/** Check deployment glob semantics and package isolation against configuration and real fixture files. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { matchesPatterns, packagedFunction, readDeploymentConfig } from './deployment-config.mts';
test('glob segments and exclusions include exactly their intended file paths', () => {
  assert.equal(matchesPatterns('src/a/data.json', ['src/*/data.json']), true);
  assert.equal(matchesPatterns('src/a/b/data.json', ['src/*/data.json']), false);
  assert.equal(matchesPatterns('src/data.json', ['src/**/data.json']), true);
  assert.equal(matchesPatterns('src/a/b/data.json', ['src/**/data.json']), true);
  assert.equal(matchesPatterns('src/a/data.json', ['src/**/*.json', '!src/a/**']), false);
  assert.equal(matchesPatterns('src/a/x.txt', ['src/**/*.json']), false);
});
test('configuration facts and function-specific file closure come from deployed inputs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'server-answers-config-'));
  let pack: Awaited<ReturnType<typeof packagedFunction>> | undefined;
  try {
    await mkdir(resolve(root, 'dist')); await mkdir(resolve(root, 'deploy')); await mkdir(resolve(root, 'data/nested'), { recursive: true });
    await writeFile(resolve(root, 'netlify.toml'), '[functions]\ndirectory = "deploy"\nincluded_files = ["data/**/*.json", "!data/private.json"]\n[functions.find]\nincluded_files = ["extra.txt"]\n[[edge_functions]]\npath = "/*"\nfunction = "router"\n[[headers]]\nfor = "/_astro/*"\n[headers.values]\nCache-Control = "immutable"\n');
    await writeFile(resolve(root, 'wrangler.jsonc'), '{ // comment\n "main": "worker/entry.mjs", "assets": {"directory": "dist", "html_handling": "auto-trailing-slash", "run_worker_first": ["/*", "!/assets/*"]}}');
    await writeFile(resolve(root, 'dist/_headers'), '/_astro/*\n  Cache-Control: immutable\n');
    await writeFile(resolve(root, 'deploy/find.mjs'), 'export default () => 1;');
    await writeFile(resolve(root, 'data/nested/value.json'), '{}'); await writeFile(resolve(root, 'data/root.json'), '{}'); await writeFile(resolve(root, 'data/private.json'), '{}'); await writeFile(resolve(root, 'extra.txt'), 'included');
    const config = await readDeploymentConfig(root);
    assert.equal(config.functionsDirectory, 'deploy'); assert.equal(config.workerMain, 'worker/entry.mjs');
    assert.deepEqual(config.edgeFunctions, [{ path: '/*', function: 'router' }]);
    assert.deepEqual(config.immutableCache, { netlify: 'immutable', assets: 'immutable' });
    assert.deepEqual(config.assets.run_worker_first, ['/*', '!/assets/*']);
    pack = await packagedFunction(root, 'find', config);
    assert.equal(await readFile(resolve(pack.root, 'extra.txt'), 'utf8'), 'included');
    assert.equal(await readFile(resolve(pack.root, 'data/root.json'), 'utf8'), '{}');
    assert.equal(await readFile(resolve(pack.root, 'data/nested/value.json'), 'utf8'), '{}');
    await assert.rejects(readFile(resolve(pack.root, 'data/private.json')), /ENOENT/u);
    await assert.rejects(readFile(resolve(pack.root, 'netlify.toml')), /ENOENT/u);
    await symlink(resolve(root, 'netlify.toml'), resolve(root, 'data/link.json'));
    // An in-root symlink is copied as bytes. An escaping one must fail even when the glob includes it.
    await symlink(resolve(root, '..'), resolve(root, 'data/escape.json'));
    await assert.rejects(packagedFunction(root, 'find', config), /escapes project root: data\/escape\.json$/u, 'the linked directory is refused itself, not walked');
  } finally { if (pack) await rm(pack.root, { recursive: true, force: true }); await rm(root, { recursive: true, force: true }); }
});
test('the Worker configuration is the one the deploy script names, its paths read from its own folder', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'server-answers-wrangler-'));
  try {
    await mkdir(resolve(root, 'dist')); await mkdir(resolve(root, 'hosts/worker'), { recursive: true });
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { 'deploy:cloudflare-preview': 'node hosts/worker/bundle.mts --noindex && npx --yes wrangler@4 deploy --config hosts/worker/wrangler.jsonc --env=""' } }));
    await writeFile(resolve(root, 'netlify.toml'), '[build]\n  edge_functions = "hosts/edge"\n[functions]\ndirectory = "hosts/functions"\n');
    // A root wrangler.jsonc the script does not name is not read.
    await writeFile(resolve(root, 'wrangler.jsonc'), '{"main":"elsewhere.mjs","assets":{"directory":"elsewhere"}}');
    await writeFile(resolve(root, 'hosts/worker/wrangler.jsonc'), '{ // comment\n "main": "bundled/worker.mjs", "assets": {"directory": "../../dist", "html_handling": "auto-trailing-slash"}}');
    const config = await readDeploymentConfig(root);
    assert.equal(config.workerMain, 'hosts/worker/bundled/worker.mjs');
    assert.equal(config.edgeDirectory, 'hosts/edge');
    assert.deepEqual(config.facts.assets, { directory: 'dist', html_handling: 'auto-trailing-slash' });
    // Facts hold what a host serves, never where the checkout keeps its files.
    for (const layout of ['functionsDirectory', 'edgeDirectory', 'workerMain']) assert.equal(layout in config.facts, false, layout);
  } finally { await rm(root, { recursive: true, force: true }); }
});
