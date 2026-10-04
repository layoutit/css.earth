import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { requireRecord, requireArray } from '@cssearth/core';
import { requireAstroqueryTests } from './astroquery-tests.mts';
import { classifyAffectedPaths, loadCiAreasConfig } from './ci-affected.mts';

function stub(count = 13, skipped = 0): string {
  return `TAP version 13\n${Array.from({ length: count }, (_, i) => `ok ${i + 1} - case ${i + 1}`).join('\n')}\n1..${count}\n# tests ${count}\n# pass ${count - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n`;
}
test('toolchain lane rejects skipped, empty, truncated, failed and short TAP runs', () => {
  requireAstroqueryTests(stub());
  for (const bad of [stub(13, 1), stub(13, 1).replace('# pass 12', '# pass 13'), stub(12), '', stub().replace('# skipped 0', ''), stub().replace('# fail 0', '# fail 1'), stub().replace('ok 1 -', 'not ok 1 -'), stub().replace('# cancelled 0', '# cancelled 1'), stub().replace('# todo 0', '# todo 1')])
    assert.throws(() => requireAstroqueryTests(bad));
});
test('astroquery classification and workflow preserve the protected lane', async () => {
  const config = await loadCiAreasConfig();
  for (const path of ['packages/telescope/src/node/toolchain/python.ts', 'packages/telescope/toolchains/toolchain.json', 'packages/telescope/toolchains/requirements.lock', 'packages/telescope-cli/src/toolchains/astronomy-toolchains.mts', 'packages/telescope-cli/src/archives/jwst/toolchain.json', 'packages/telescope-cli/src/archives/toolchain-descriptor.mts', 'packages/telescope-cli/src/vo/package.mts', 'packages/telescope-cli/src/families/f07-dynamic-spectrum.mts', '.github/ci-areas.json', 'packages/telescope-cli/src/families/f07-dynamic-spectrum.test.mts', 'packages/telescope-cli/src/vo/package.test.mts', '.github/workflows/universe.yml'])
    assert.ok(classifyAffectedPaths([path], config).jobs.has('astroquery'), path);
  for (const path of ['README.md', 'packages/renderer/src/index.ts', 'site/runtime-policy.mts'])
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
  assert.match(runs, /node --test --test-reporter=tap .*f07-dynamic-spectrum\.test\.mts .*vo\/package\.test\.mts/u);
  assert.match(runs, /node \.github\/scripts\/ci\/astroquery-tests\.mts astroquery.tap/u);
  assert.ok(requireArray(requireRecord(jobs['ci-guard']).needs).includes('astroquery'));
});

test('astronomy CLI-only objects dependency remains ordered ahead of its build', async () => {
  const { readWorkspaceGraph, workspaceOrder } = await import('@cssearth/bake/preparation/workspace-graph');
  const root = new URL('../../../', import.meta.url).pathname;
  const manifest = requireRecord(JSON.parse(await readFile(new URL('../../../packages/astronomy/package.json', import.meta.url), 'utf8')));
  assert.equal(requireRecord(manifest.devDependencies)['@cssearth/objects'], 'workspace:*');
  assert.equal(manifest.dependencies, undefined);
  const names = workspaceOrder(readWorkspaceGraph(root), ['@cssearth/astronomy']).map(entry => entry.name);
  assert.ok(names.indexOf('@cssearth/objects') < names.indexOf('@cssearth/astronomy'));
});
