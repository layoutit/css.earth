/** Check deployment glob semantics and the Worker configuration against real fixture files. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { matchesPatterns, readDeploymentConfig } from './deployment-config.mts';
test('glob segments and exclusions include exactly their intended file paths', () => {
  assert.equal(matchesPatterns('src/a/data.json', ['src/*/data.json']), true);
  assert.equal(matchesPatterns('src/a/b/data.json', ['src/*/data.json']), false);
  assert.equal(matchesPatterns('src/data.json', ['src/**/data.json']), true);
  assert.equal(matchesPatterns('src/a/b/data.json', ['src/**/data.json']), true);
  assert.equal(matchesPatterns('src/a/data.json', ['src/**/*.json', '!src/a/**']), false);
  assert.equal(matchesPatterns('src/a/x.txt', ['src/**/*.json']), false);
});
test('configuration facts come from the deployed Worker configuration and its built header rules', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'server-answers-config-'));
  try {
    await mkdir(resolve(root, 'dist'));
    await writeFile(resolve(root, 'wrangler.jsonc'), '{ // comment\n "main": "worker/entry.mjs", "assets": {"directory": "dist", "html_handling": "auto-trailing-slash", "run_worker_first": ["/*", "!/assets/*"]}}');
    await writeFile(resolve(root, 'dist/_headers'), '/_astro/*\n  Cache-Control: immutable\n');
    const config = await readDeploymentConfig(root);
    assert.equal(config.workerMain, 'worker/entry.mjs');
    assert.equal(config.immutableCache, 'immutable');
    assert.deepEqual(config.headerRules, [{ path: '/_astro/*', values: { 'cache-control': 'immutable' } }]);
    assert.deepEqual(config.assets.run_worker_first, ['/*', '!/assets/*']);
    assert.deepEqual(Object.keys(config.facts).sort(), ['assets', 'headerRules', 'immutableCache']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('the Worker configuration is the one the deploy script names, its paths read from its own folder', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'server-answers-wrangler-'));
  try {
    await mkdir(resolve(root, 'dist')); await mkdir(resolve(root, 'hosts/worker'), { recursive: true });
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { 'deploy:cloudflare-preview': 'node hosts/worker/bundle.mts --noindex && npx --yes wrangler@4 deploy --config hosts/worker/wrangler.jsonc --env=""' } }));
    // A root wrangler.jsonc the script does not name is not read.
    await writeFile(resolve(root, 'wrangler.jsonc'), '{"main":"elsewhere.mjs","assets":{"directory":"elsewhere"}}');
    await writeFile(resolve(root, 'hosts/worker/wrangler.jsonc'), '{ // comment\n "main": "bundled/worker.mjs", "assets": {"directory": "../../dist", "html_handling": "auto-trailing-slash"}}');
    const config = await readDeploymentConfig(root);
    assert.equal(config.workerMain, 'hosts/worker/bundled/worker.mjs');
    assert.deepEqual(config.facts.assets, { directory: 'dist', html_handling: 'auto-trailing-slash' });
    // Facts hold what a host serves, never where the checkout keeps its files.
    assert.equal('workerMain' in config.facts, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
