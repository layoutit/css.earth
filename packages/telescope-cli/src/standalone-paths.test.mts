import './test-support/index.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { requireWorkspace } from '@cssearth/telescope-core/node';
import { loadTargetCatalogueSnapshot } from './observation-query/query.mts';
import { prepareStandaloneData } from './test-support/standalone-data.test-support.mts';

const checkout = requireWorkspace();
test('runs stay in cwd; archive answers and every toolchain stay central without a workspace', async t => {
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
    const resolver = await import(${url('packages/telescope-core/src/node/toolchain/resolver.ts')});
    assert.deepEqual(resolver.legacyWorkspaceRoots(), []);
    const pins = { id: 'pds', file: 'pins.json', descriptor: '{}', lock: null, entry: {} };
    const candidates = resolver.installedToolchainCandidates(resolve(core.USER_ROOT, 'output/toolchains/pds'), pins);
    assert.ok(candidates.every(path => !path.startsWith(${JSON.stringify(checkout)} + '/')), 'Unadmitted checkout must never be a toolchain candidate');
    assert.equal(resolver.resolveInstalledToolchain(resolve(core.USER_ROOT, 'output/toolchains/pds'), pins), null);
    assert.throws(() => core.requireWorkspace(), error => {
      assert.doesNotMatch(error.message, /writes|bakes/);
      const command = /telescope export RESULT --output html --out DIRECTORY/.exec(error.message);
      assert.ok(command, 'Recovery command must include its output directory');
      return true;
    });
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
    // Only the generated snapshot may supply catalogue entries outside a workspace.
    assert.deepEqual(catalogue, await query.loadTargetCatalogueSnapshot());
    const explore = await import(${url('packages/telescope-cli/src/exploration.mts')}); let asked = false;
    const request = await explore.skyTargetRequest(core.USER_ROOT, { target: 'not-in-the-catalogue' }, async (root, name) => {
      assert.equal(root, core.USER_ROOT); assert.equal(name, 'not-in-the-catalogue'); asked = true; return undefined;
    });
    assert.equal(asked, true); assert.equal(request.simbadMiss, true);
    const leads = await import(${url('packages/telescope-cli/src/archive-adapters/archive-leads.mts')});
    const pin = await leads.saveArchiveLeadEvidence(${JSON.stringify(checkout)}, 'https://example.org/TAP', 'test', []);
    assert.ok((await readdir(resolve(core.USER_ROOT, 'output/telescopes/archive-leads'))).includes(pin + '.json'));
    assert.throws(() => core.astroqueryToolchainSync(), /telescope toolchain install astroquery/);
    const runs = await import(${url('packages/telescope-cli/src/run-directory.mts')});
    const run = runs.runDirectory('Betelgeuse');
    assert.equal(run.startsWith(resolve(process.cwd(), 'telescope-runs') + '/'), true);
    assert.equal(run.startsWith(core.USER_ROOT + '/'), false);
    assert.equal(run.startsWith(${JSON.stringify(checkout)} + '/'), false);
    const cliArguments = await import(${url('packages/telescope-cli/src/cli/cli-arguments.mts')});
    for (const name of ['chandra', 'spitzer', 'hst', 'gemini', 'keck', 'naco', 'tess', 'mearth', 'espadons']) {
      assert.throws(() => core.assertInstalledMarker('/missing', { ...pins, id: name }, name,
        'node packages/telescope-cli/src/archives/' + name + '/toolchain.mts install'), error => {
        assert.doesNotMatch(error.message, /packages\\/|\\.mts|pnpm /);
        const command = error.message.slice(error.message.indexOf('telescope toolchain'));
        assert.equal(cliArguments.parseCli(command.split(' ').slice(1)).name, name); return true;
      });
    }

    const other = await import(${url('packages/telescope-cli/src/archive-adapters/other-leads.mts')});
    for (const [search, id] of [[other.searchChandraLeads, 'jupiter'], [other.searchSpitzerLeads, 'eris']]) {
      let network = false;
      const answer = await search(core.USER_ROOT, { id, name: id, aliases: [] }, undefined, async () => { network = true; return []; });
      assert.equal(network, true, answer.reason); assert.equal(answer.state, 'empty-in-scope', answer.reason);
    }
    const targets = await import(${url('packages/telescope-cli/src/archives/targets.mts')});
    const polaris = await targets.namedShippedObject('polaris', undefined, core.USER_ROOT);
    assert.ok(polaris.position, 'Standalone targets retain their shipped sky positions');
    const { main } = await import(${url('packages/telescope-cli/src/cli.mts')}); let output = '';
    assert.equal(await main(['new-object', 'missing.json', '--json'], undefined, text => { output += text; }), 2);
    assert.match(JSON.parse(output).error, /this command needs a css\\.earth checkout: pass --workspace/);
    assert.match(JSON.parse(output).error, /new-object.*site records/u);
    assert.match(JSON.parse(output).error, /telescope export RESULT --output html --out DIRECTORY/u);
    assert.equal(JSON.parse(output).exitCode, 2);
    const { DRAFT_ROUTES } = await import(${url('packages/telescope-cli/src/new-object/drafts.mts')});
    for (const args of [
      ['new-object', 'missing.json', '--check'], ['new-object', 'missing.json', '--bake'],
      ['new-object', 'missing.json', '--skip-existing'], ['new-object', '--bake', 'eris'],
      ['new-object', '--refresh', 'eris'],
      ...Object.keys(DRAFT_ROUTES).map(route => ['new-object', '--from-' + route, 'missing', '--out', 'draft.json']),
    ]) {
      output = '';
      assert.equal(await main([...args, '--json'], undefined, text => { output += text; }), 2, args.join(' '));
      assert.match(JSON.parse(output).error, /telescope export RESULT --output html --out DIRECTORY/u);
    }
    for (const [file, name] of [
      ['f16-cartesian-grid.mts', 'preparePhysicalCartesianVolume'],
      ['f16-spherical-grid.mts', 'preparePhysicalSphericalVolume'],
    ]) {
      const module = await import(${url('packages/telescope-cli/src/families/f16/')} + '/' + file);
      await assert.rejects(module[name]({}), error => error instanceof TypeError
        && /site records|prepared assets/u.test(error.message)
        && /telescope export RESULT --output html --out DIRECTORY/u.test(error.message));
    }
    const { executeFamilyOperation } = await import(${url('packages/telescope-cli/src/family-operation.mts')});
    for (const operationId of ['physical-grid-prepare-volume', 'spherical-grid-prepare-volume']) {
      await assert.rejects(executeFamilyOperation('missing.json', { operationId }, 'volume'), error => error instanceof TypeError
        && /telescope export RESULT --output html --out DIRECTORY/u.test(error.message));
    }
    const compilerPath = process.env.PATH; process.env.PATH = ${JSON.stringify(directory)};
    try {
      const failures = await Promise.allSettled([core.astroqueryToolchain(), core.astroqueryToolchain()]);
      for (const failure of failures) {
        assert.equal(failure.status, 'rejected');
        assert.match(failure.reason.message, /source builds need a working/);
        assert.match(failure.reason.message, process.platform === 'darwin' ? /xcode-select --install/ : /build-essential/);
        assert.doesNotMatch(failure.reason.message, /pip install/);
      }
      assert.equal(failures[0].reason, failures[1].reason, 'one failed prerequisite is shared across archive clients');
      assert.ok(!(await readdir(resolve(core.USER_ROOT, 'astroquery'), { recursive: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).some(name => name.endsWith('env/bin/python')));
    } finally { process.env.PATH = compilerPath; }
    console.log('STANDALONE_PATHS_OK');
  `;
  try {
    const data = await prepareStandaloneData(checkout);
    t.after(data.cleanup);
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, CSSEARTH_TELESCOPE_HOME: home };
    delete env.CSSEARTH_WORKSPACE; delete env.CSS_EARTH_ASTROQUERY_CACHE; delete env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME;
    const child = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--import', resolve(checkout, 'packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', data.script + script], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /STANDALONE_PATHS_OK/u);
    assert.deepEqual((await readdir(directory)).sort(), ['user']);
    for (const json of [false, true]) {
      const refused = spawnSync(process.execPath, [resolve(checkout, 'packages/telescope-cli/src/bin.mts'),
        'new-object', 'missing.json', ...(json ? ['--json'] : [])], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(refused.status, 2, refused.stderr);
      assert.match(refused.stderr, /new-object.*site records/u);
      assert.match(refused.stderr, /telescope export RESULT --output html --out DIRECTORY/u);
      if (json) assert.equal(JSON.parse(refused.stdout).exitCode, 2);
      else assert.equal(refused.stdout, '');
    }
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
