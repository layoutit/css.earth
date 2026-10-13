import './test-user-root.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { requireWorkspace } from '@cssearth/telescope-core/node';
import { loadTargetCatalogueSnapshot } from './observation-query/query.mts';

const checkout = requireWorkspace();
test('explore paths, archive answers and every toolchain stay outside the checkout without a workspace', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-outside-')), home = resolve(directory, 'user');
  const url = (file: string) => JSON.stringify(pathToFileURL(resolve(checkout, file)).href);
  const script = `
    import assert from 'node:assert/strict';
    import { resolve, relative } from 'node:path';
    import { readdir } from 'node:fs/promises';
    const core = await import(${url('packages/telescope-core/src/node/index.ts')});
    const built = await import(${url('packages/telescope-core/dist/node/index.js')});
    assert.equal(core.WORKSPACE, undefined); assert.equal(built.WORKSPACE, undefined);
    assert.equal(core.USER_ROOT, ${JSON.stringify(home)});
    for (const name of ['SCRATCH_ROOT','ASTROQUERY_ROOT','ASTROQUERY_CACHE','MAST_CACHE','PDS_TOOLCHAIN_ROOT','STARRY_ROOT','SPIDERMAN_ROOT','PICASO_ROOT']) {
      assert.ok(!relative(core.USER_ROOT, core[name]).startsWith('..'), name);
      assert.equal(core[name], built[name], name + ' source/build roots');
    }
    for (const name of ['chandra','espadons','gemini','hst','interferometry','jwst','keck','mearth','naco','spitzer','tess']) {
      const module = await import(${url('packages/telescope-cli/src/archives/')} + '/' + name + '/toolchain.mts');
      if (name === 'jwst') assert.ok(module.toolchainRoot('jwst').startsWith(core.USER_ROOT + '/'));
      for (const [key, value] of Object.entries(module)) if (key.endsWith('_ROOT') && typeof value === 'string') assert.ok(value.startsWith(core.USER_ROOT + '/'), name + '/' + key);
    }
    const query = await import(${url('packages/telescope-cli/src/observation-query/query.mts')});
    const catalogue = await query.loadTargetCatalogue(core.USER_ROOT);
    const paths = await import(${url('packages/telescope-cli/src/paths.mts')});
    assert.ok(paths.TARGET_CATALOGUE_SNAPSHOT.startsWith(paths.CLI_PACKAGE_ROOT + '/data/'));
    // Step 2 has no generated snapshot. A real checkout is present at the source location and must not be read.
    assert.deepEqual(catalogue, []);
    const explore = await import(${url('packages/telescope-cli/src/exploration.mts')}); let asked = false;
    const request = await explore.skyTargetRequest(core.USER_ROOT, { target: 'eris' }, async (root, name) => {
      assert.equal(root, core.USER_ROOT); assert.equal(name, 'eris'); asked = true; return undefined;
    });
    assert.equal(asked, true); assert.equal(request.simbadMiss, true);
    const leads = await import(${url('packages/telescope-cli/src/archive-adapters/archive-leads.mts')});
    const pin = await leads.saveArchiveLeadEvidence(${JSON.stringify(checkout)}, 'https://example.org/TAP', 'test', []);
    assert.ok((await readdir(resolve(core.USER_ROOT, 'output/telescopes/archive-leads'))).includes(pin + '.json'));
    const { main } = await import(${url('packages/telescope-cli/src/cli.mts')}); let output = '';
    assert.equal(await main(['new-object', 'missing.json', '--json'], undefined, text => { output += text; }), 1);
    assert.match(JSON.parse(output).error, /this command needs a css\\.earth checkout: pass --workspace/);
    console.log('STANDALONE_PATHS_OK');
  `;
  try {
    const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: home };
    delete env.CSSEARTH_WORKSPACE; delete env.CSS_EARTH_ASTROQUERY_CACHE;
    const child = spawnSync(process.execPath, ['--import', resolve(checkout, 'packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', script], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /STANDALONE_PATHS_OK/u);
    assert.deepEqual((await readdir(directory)).sort(), ['user']);
    const invalid = spawnSync(process.execPath, [resolve(checkout, 'packages/telescope-cli/run-typed-module.mjs'), resolve(checkout, 'packages/telescope-cli/src/cli.mts'),
      'explore', 'eris', '--workspace', '--json'], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(invalid.status, 2, invalid.stderr); assert.match(JSON.parse(invalid.stdout).error, /--workspace requires a path/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('target snapshot validates package data, distinguishes missing from malformed and retains names', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-snapshot-')), path = resolve(directory, 'catalogue.json');
  try {
    assert.deepEqual(await loadTargetCatalogueSnapshot(path), []);
    const value = [{ id: 'sample', name: 'Sample', aliases: ['Alias'], archiveClass: 'star', classificationSource: 'source' }];
    await writeFile(path, JSON.stringify(value)); assert.deepEqual(await loadTargetCatalogueSnapshot(path), value);
    await writeFile(path, JSON.stringify([{ id: 'sample', name: 'Sample', aliases: [12] }]));
    await assert.rejects(loadTargetCatalogueSnapshot(path), TypeError);
    await writeFile(path, '{'); await assert.rejects(loadTargetCatalogueSnapshot(path), SyntaxError);
    assert.equal(await readFile(path, 'utf8'), '{');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
