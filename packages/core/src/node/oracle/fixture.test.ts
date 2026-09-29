import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleFixture } from './fixture.mts';

const root = projectRoot(import.meta.url);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),fixture:(await m.readOracleFixture('fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ root, pins: sourcePins, fixture: (await readOracleFixture('fits/core.json')).generatedBy });
  }
  for (const name of ['fixture.py', 'requirements.txt']) {
    expect(await readFile(resolve(root, 'packages/core/dist/oracle', name))).toEqual(
      await readFile(new URL(name, import.meta.url)));
  }
});

it('kernel inputs require their owner verifier and propagate its rejection', async () => {
  const inputs = [{ path: 'src/spice/new-horizons/lsk/naif0012.tls' }];
  await expect(assertPinnedInputs(inputs)).rejects.toThrow('Kernel oracle inputs require the caller bank verifier.');
  await expect(assertPinnedInputs(inputs, async (set, kernels) => {
    expect(set).toBe('new-horizons');
    expect(kernels).toEqual(['lsk/naif0012.tls']);
    throw new Error('bank rejected');
  })).rejects.toThrow('bank rejected');
});

it('the Python writer finds the module-relative root in both source and distribution', () => {
  for (const path of ['packages/core/src/node/oracle/fixture.py', 'packages/core/dist/oracle/fixture.py']) {
    const result = spawnSync('python3', ['-c',
      'import runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); print(runpy.run_path(sys.argv[1])["ROOT"])',
      fileURLToPath(new URL(path, `file://${root}/`))], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(root);
  }
});
