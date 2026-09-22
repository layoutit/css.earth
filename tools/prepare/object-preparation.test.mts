import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { readObjectPreparation, resolveObjectPreparation, runObjectPreparation } from './object-preparation.mts';
import type { PreparationCommand } from '../../src/platform/preparation-runner.mts';

const projectRoot = resolve(import.meta.dirname, '../..');
const expectedRecipes = {mercury: true, venus: true};
async function descriptor(id: string) {
  return JSON.parse(await readFile(resolve(projectRoot, 'src/objects', id, 'object.json'), 'utf8'));
}
function expectedSteps(id: string) {
  return [['../../../../tools/objects/dist/prepare-authored.js', id, '--write']];
}

for (const id of Object.keys(expectedRecipes)) {
  test(`${id} executes the approved producers, arguments and ordering`, async () => {
    const plan = await readObjectPreparation(resolve(projectRoot, 'src/objects', id, 'object.json'));
    assert.deepEqual(plan.steps, expectedSteps(id));
    assert.equal(plan.objectName, id[0].toUpperCase() + id.slice(1));
    const calls: PreparationCommand[] = [];
    await runObjectPreparation(resolve(projectRoot, 'src/objects', id, 'object.json'), {
      runCommand: async call => { calls.push(call); },
    });
    assert.deepEqual(calls.map(({ script, argumentsList }) => [script, argumentsList]),
      expectedSteps(id).map(([script, ...args]) => [resolve(plan.toolDirectory, script), args]));
  });

  test(`${id} default subprocess dispatch preserves inherited cwd and executes the full recipe`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'object-preparation-default-'));
    try {
      const input = await descriptor(id), plan = resolveObjectPreparation(input, { projectRoot: root });
      const descriptorPath = resolve(plan.toolDirectory, '../object.json'), cwd = join(root, 'caller'), log = join(root, 'calls.ndjson');
      await mkdir(cwd, { recursive: true });
      await mkdir(plan.toolDirectory, { recursive: true });
      await writeFile(descriptorPath, JSON.stringify(input));
      for (const [script] of plan.steps) {
        const path = resolve(plan.toolDirectory, script);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `import {appendFileSync} from 'node:fs';\nappendFileSync(process.env.PREPARATION_TEST_LOG, JSON.stringify({script:process.argv[1],args:process.argv.slice(2),cwd:process.cwd()})+'\\n');\n`);
      }
      const code = `import {runObjectPreparation} from ${JSON.stringify(pathToFileURL(resolve(import.meta.dirname, 'object-preparation.mts')).href)}; await runObjectPreparation(${JSON.stringify(descriptorPath)}, {projectRoot:${JSON.stringify(root)}});`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        cwd, env: { ...process.env, PREPARATION_TEST_LOG: log }, encoding: 'utf8',
      });
      assert.equal(child.status, 0, child.stderr);
      const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      const inheritedCwd = await realpath(cwd);
      assert.deepEqual(calls, expectedSteps(id).map(([script, ...args]) => ({ script: resolve(plan.toolDirectory, script), args, cwd: inheritedCwd })));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('recipe data cannot supply executable paths, arguments or unsupported types', async () => {
  const input = await descriptor('mercury');
  const recipe = input.properties.preparation;
  for (const preparation of [null, { ...recipe, schema: 'future' }, { ...recipe, steps: [] },
    { ...recipe, steps: ['title', 'title'] }, { ...recipe, steps: ['../../arbitrary.mjs'] },
    { ...recipe, steps: [{ script: 'prepare-title.mjs' }] }, { ...recipe, args: ['--execute'] }]) {
    assert.throws(() => resolveObjectPreparation({ ...input, properties: { preparation } }), TypeError);
  }
  assert.throws(() => resolveObjectPreparation({ ...input, type: 'unknown' }), TypeError);
});

test('a failed producer stops before subsequent recipe capabilities', async () => {
  const calls: string[] = [];
  await assert.rejects(runObjectPreparation(resolve(projectRoot, 'src/objects/venus/object.json'), {
    async runCommand({ script }) {
      calls.push(script);
      if (script.endsWith('prepare-authored.js')) throw new Error('producer failed');
    },
  }), /producer failed/);
  assert.deepEqual(calls.map(path => path.split('/').at(-1)), ['prepare-authored.js']);
});
