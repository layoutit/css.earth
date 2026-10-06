import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { requireRecord, requireArray } from '@cssearth/core';
import { astroqueryTestFiles, astroqueryLaneFiles, astroqueryTriggerPaths, ASTROQUERY_EXCLUSIONS } from './astroquery-discovery.mts';
import { requireAstroqueryTests, runAstroqueryFiles } from './astroquery-tests.mts';
import { classifyAffectedPaths, loadCiAreasConfig } from './ci-affected.mts';

function stub(count = 13, skipped = 0): string {
  return `TAP version 13\n${Array.from({ length: count }, (_, i) => `ok ${i + 1} - case ${i + 1}`).join('\n')}\n1..${count}\n# tests ${count}\n# pass ${count - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n`;
}
test('toolchain lane rejects skipped, empty, truncated, failed and short TAP runs', () => {
  requireAstroqueryTests(stub(), 13);
  for (const bad of [stub(13, 1), stub(13, 1).replace('# pass 12', '# pass 13'), stub(12), '', stub().replace('# skipped 0', ''), stub().replace('# fail 0', '# fail 1'), stub().replace('ok 1 -', 'not ok 1 -'), stub().replace('# cancelled 0', '# cancelled 1'), stub().replace('# todo 0', '# todo 1')])
    assert.throws(() => requireAstroqueryTests(bad, 13));
});
test('astroquery classification and workflow preserve the protected lane', async () => {
  const config = await loadCiAreasConfig();
  for (const path of ['packages/telescope/src/node/toolchain/python.ts', 'packages/telescope/toolchains/toolchain.json', 'packages/telescope/toolchains/requirements.lock', 'packages/telescope-cli/src/toolchains/astronomy-toolchains.mts', 'packages/telescope-cli/src/archives/jwst/toolchain.json', 'packages/telescope-cli/src/archives/toolchain-descriptor.mts', 'packages/telescope-cli/src/vo/package.mts', 'packages/telescope-cli/src/families/f07-dynamic-spectrum.mts', '.github/ci-areas.json', 'packages/telescope-cli/src/families/f07-dynamic-spectrum.test.mts', 'packages/telescope-cli/src/vo/package.test.mts', '.github/workflows/universe.yml'])
    assert.ok(classifyAffectedPaths([path], config).jobs.has('astroquery'), path);
  for (const path of ['README.md', 'site/browser/runtime-policy.mts'])
    assert.equal(classifyAffectedPaths([path], config).jobs.has('astroquery'), false, path);
  const workflow = requireRecord(parse(await readFile(new URL('../../workflows/universe.yml', import.meta.url), 'utf8')));
  const jobs = requireRecord(workflow.jobs), job = requireRecord(jobs.astroquery);
  assert.equal(job.if, "${{ needs.changes.outputs.run_astroquery == 'true' }}");
  assert.equal(requireRecord(requireRecord(jobs.changes).outputs).run_astroquery, '${{ steps.classify.outputs.run_astroquery }}');
  const steps = requireArray(job.steps).map(step => requireRecord(step));
  const runs = steps.map(step => step.run ?? '').join('\n');
  assert.match(runs, /micromamba-releases\/releases\/download\/\d+\.\d+\.\d+-\d+\/micromamba-linux-64/u, 'the runner has no micromamba: the lane installs a pinned release first');
  assert.ok(runs.indexOf('micromamba-linux-64') < runs.indexOf('astroquery install'), 'micromamba is installed before the toolchain installer runs');
  assert.match(runs, /astronomy-toolchains\.mts astroquery install/u);
  assert.match(runs, /astronomy-toolchains\.mts astroquery verify/u);
  assert.match(runs, /node \.github\/scripts\/ci\/astroquery-tests\.mts --list/u);
  assert.match(runs, /node \.github\/scripts\/ci\/astroquery-tests\.mts --run/u);
  assert.ok(requireArray(requireRecord(jobs['ci-guard']).needs).includes('astroquery'));
});

test('astronomy public source reader ships objects and remains ordered ahead of its build', async () => {
  const { readWorkspaceGraph, workspaceOrder } = await import('@cssearth/bake/preparation/workspace-graph');
  const root = new URL('../../../', import.meta.url).pathname;
  const manifest = requireRecord(JSON.parse(await readFile(new URL('../../../packages/astronomy/package.json', import.meta.url), 'utf8')));
  assert.equal(requireRecord(manifest.dependencies)['@cssearth/objects'], 'workspace:*');
  assert.equal(requireRecord(manifest.devDependencies)['@cssearth/objects'], undefined);
  const names = workspaceOrder(readWorkspaceGraph(root), ['@cssearth/astronomy']).map(entry => entry.name);
  assert.ok(names.indexOf('@cssearth/objects') < names.indexOf('@cssearth/astronomy'));
});

test('a not-ok result cannot hide behind complete passing counts', () => {
  assert.throws(() => requireAstroqueryTests(stub() + 'not ok 99 - unreported failure\n'), /did not pass/u);
});

test('every TAP summary must be present exactly once', () => {
  for (const name of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const value = name === 'tests' || name === 'pass' ? 13 : 0;
    assert.throws(() => requireAstroqueryTests(stub() + `# ${name} ${value}\n`), /ambiguous TAP/u, name);
    assert.throws(() => requireAstroqueryTests(stub().replace(`# ${name} ${value}\n`, '')), /Missing or ambiguous TAP/u, name);
  }
});

test('filtered astroquery classification survives projection into the runnable job list', async () => {
  const { affectedJobNames } = await import('./ci-affected.mts');
  const config = await loadCiAreasConfig();
  const selected = classifyAffectedPaths(['packages/telescope/src/node/toolchain/python.ts'], config);
  assert.ok(affectedJobNames(selected).includes('astroquery'), 'the selected filtered lane must remain runnable');
  const ordinary = classifyAffectedPaths(['README.md'], config);
  assert.ok(!affectedJobNames(ordinary).includes('astroquery'), 'ordinary documentation does not run the filtered lane');
});


test('all toolchain-importing files are discovered; only named source exclusions remain', () => {
  const root = new URL('../../../', import.meta.url).pathname;
  const all = astroqueryTestFiles(root), files = astroqueryLaneFiles(root);
  const imported = execFileSync('git', ['grep', '-l', '-w', 'astroqueryToolchain', '--', 'packages/**/*.test.*'], { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(all, imported);
  assert.ok(all.length > 2);
  assert.match(ASTROQUERY_EXCLUSIONS['packages/telescope-cli/src/delivery/output-handoffs.test.mts'] ?? '', /PDS.*stellar-neighbourhood.*stars\.json\/stars\.bin/u);
  assert.equal(files.length, all.length - Object.keys(ASTROQUERY_EXCLUSIONS).length);
  assert.deepEqual(all.filter(file => !files.includes(file)), Object.keys(ASTROQUERY_EXCLUSIONS).sort());
  const triggers = astroqueryTriggerPaths(root);
  for (const name of ['telescope-cli', 'telescope', 'core', 'objects', 'fits', 'bake', 'renderer', 'astronomy', 'engine', 'spice']) assert.ok(triggers.includes(`packages/${name}/**`));
});


test('runner executes exactly the derived files and a skip makes the run red', () => {
  const root = new URL('../../../', import.meta.url).pathname;
  const files = astroqueryLaneFiles(root), visited: string[] = [];
  assert.throws(() => runAstroqueryFiles(root, () => ({ status: 0, stdout: stub(1, 1), stderr: '' })), /skipped/u);
  const ran = runAstroqueryFiles(root, file => { visited.push(file); return { status: 0, stdout: stub(1), stderr: '' }; });
  assert.equal(ran, files.length);
  assert.deepEqual(visited, files);
});
