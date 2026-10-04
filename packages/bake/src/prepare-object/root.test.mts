import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { prepareObjects, PREPARATION_STEPS } from './index.ts';

test('an explicit checkout owns object lookup, geometry lookup and both child execution lanes', async () => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'prepare-object-root-')));
  const put = async (path: string, text: string) => {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, text);
  };
  try {
    await put('src/objects/root-fixture/object.json', '{}');
    await put('packages/astronomy/data/bodies/root-fixture.json', '{}');
    const geometry = PREPARATION_STEPS.find(step => step.name === 'geometry')!;
    assert.deepEqual(await geometry.commands(['root-fixture'], { root }), [['node', 'packages/bake/cli/prepare-solar-geometry.mts']]);
    for (const [step, script] of [
      ['builds', 'packages/bake/cli/check-stale-builds.mts'],
      ['sources', 'site/build/prepare/author-source-records.mts'],
    ]) {
      await put(script!, `import { writeFileSync } from 'node:fs'; writeFileSync('${step}.cwd', process.cwd());`);
      assert.equal(await prepareObjects(['root-fixture'], { root, from: step, to: step, progress: () => {} }), true);
      assert.equal(await readFile(resolve(root, `${step}.cwd`), 'utf8'), root);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the default checkout resolves from the module even when launched outside it', () => {
  const url = new URL('./index.ts', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { prepareObjects } = await import(${JSON.stringify(url)}); if (!await prepareObjects(['sun'], {from:'catalogue',to:'builds',progress:()=>{}})) process.exit(1); console.log('MODULE_ROOT_OK');`],
  { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /MODULE_ROOT_OK/);
});

test('spawn failure reports ENOENT immediately in inherited and captured execution lanes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-spawn-'));
  try {
    await mkdir(resolve(root, 'src/objects/spawn-fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/spawn-fixture/object.json'), '{}');
    const url = new URL('./index.ts', import.meta.url).href;
    for (const step of ['world', 'sources']) {
      const code = `const { prepareObjects } = await import(${JSON.stringify(url)}); process.env.PATH = ''; const start = performance.now(); const ok = await prepareObjects(['spawn-fixture'], { root: ${JSON.stringify(root)}, from: '${step}', to: '${step}', progress: () => {} }); if (ok || performance.now() - start >= 1000) process.exit(1); console.log('SPAWN_FAILURE_OK');`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /SPAWN_FAILURE_OK/u);
      assert.match(result.stderr, new RegExp(`Step "${step}" failed running:`));
      assert.match(result.stderr, /spawn (?:pnpm|node) ENOENT/u);
      assert.doesNotMatch(result.stderr, /Could not terminate/u);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
