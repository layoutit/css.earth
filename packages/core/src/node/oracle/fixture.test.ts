import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { requireRecord, requireString } from '../../index.js';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture, fitsArchiveInputs } from './fixture.mts';

const root = projectRoot(import.meta.url);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  const archiveInputs = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/bake/src/objects/layers/observation/fixtures/fits/archive-inputs.json'), 'utf8'))).inputs;
  expect(await fitsArchiveInputs()).toEqual(archiveInputs);
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),archiveInputs:await m.fitsArchiveInputs(),fixture:(await m.readOracleFixture('fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ root, pins: sourcePins, archiveInputs, fixture: (await readOracleFixture('fits/core.json')).generatedBy });
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

it('every relocated generator resolves its logical output and preserves historical input identities without writing', async () => {
  const reader = await readFile(new URL('fixture.mts', import.meta.url), 'utf8');
  const runner = await readFile(new URL('run.mts', import.meta.url), 'utf8');
  const table = /const relocatedPaths:[^=]+ = (\{[\s\S]*?\n\});/u.exec(reader);
  const generatorTable = /const relocated:[^=]+ = (\{[\s\S]*?\n\});/u.exec(runner);
  if (!table || !generatorTable) throw new Error('Expected oracle relocation tables.');
  const entries = [...table[1]!.matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
    .map(match => [match[1]!, match[2]!] as const);
  const generators = [...generatorTable[1]!.matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
    .map(match => [match[1]!, match[2]!] as const).filter(([, path]) => path.endsWith('.py'));
  expect(generators.length).toBeGreaterThan(0);
  const inputs = entries.filter(([historical]) => historical.startsWith('tests/fixtures/'));
  const result = spawnSync('python3', ['-B', '-c', `
import ast, json, runpy, sys, types
sys.modules['numpy'] = types.ModuleType('numpy')
m = runpy.run_path(sys.argv[1])
root = m['ROOT']
request = json.loads(sys.stdin.read())
outputs = dict(request['outputs'])
for logical, generator in request['generators']:
    tree = ast.parse((root / generator).read_text())
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'write']
    assert len(calls) == 1, generator
    name = ast.literal_eval(calls[0].args[0])
    assert name == logical + '.json', generator
    assert str(m['fixture_path'](name).relative_to(root)) == outputs['tests/oracles/' + name], generator
    fixture = json.loads(m['fixture_path'](name).read_text())
    # The earlier tools-to-tests move changed the generator prefix; retain that existing difference.
    assert ast.literal_eval(calls[0].args[2]) == fixture['generatedBy'].replace('tools/oracles/', 'tests/oracles/'), generator
    for record in fixture['inputs']:
        if record['path'] in outputs:
            assert m['input_record'](root / outputs[record['path']]) == record, (generator, record)
    if logical == 'fits/rice':
        assignment = next(n for n in ast.walk(tree) if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Subscript) and isinstance(n.targets[0].value, ast.Name) and n.targets[0].value.id == 'cases' and isinstance(n.value, ast.Dict) and any(isinstance(key, ast.Constant) and key.value == 'path' for key in n.value.keys))
        expression = next(value for key, value in zip(assignment.value.keys, assignment.value.values) if isinstance(key, ast.Constant) and key.value == 'path')
        for case in fixture['cases'].values():
            if 'path' not in case: continue
            path = root / outputs[case['path']]
            actual = eval(compile(ast.Expression(expression), generator, 'eval'), {'path': path, 'ROOT': root, 'input_record': m['input_record']})
            assert actual == case['path'], (generator, actual)
for historical, current in request['inputs']:
    assert m['input_record'](root / current)['path'] == historical, current
print(json.dumps({'generators': len(request['generators']), 'inputs': len(request['inputs'])}))
`, resolve(root, 'packages/core/src/node/oracle/fixture.py')], {
    cwd: tmpdir(), encoding: 'utf8', input: JSON.stringify({ outputs: entries, generators, inputs }),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ generators: generators.length, inputs: inputs.length });
});

it('Python and TypeScript resolve relocated oracle fixtures to the same current files', async () => {
  const result = spawnSync('python3', ['-c',
    'import json, runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); m = runpy.run_path(sys.argv[1]); print(json.dumps({k: str(m["fixture_path"](k)) for k in sorted(m["relocated"])}))',
    resolve(root, 'packages/core/src/node/oracle/fixture.py')], { cwd: tmpdir(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  const paths: unknown = JSON.parse(result.stdout);
  expect(typeof paths).toBe('object');
  if (!paths || typeof paths !== 'object') throw new TypeError('Expected oracle fixture paths.');
  for (const name of Object.keys(paths).sort()) {
    const path: unknown = Reflect.get(paths, name);
    if (typeof path !== 'string') throw new TypeError('Expected an oracle fixture path.');
    const { name: logicalName, ...logical } = await readOracleFixture(name);
    const { name: absoluteName, ...absolute } = await readOracleFixture(path);
    expect(logicalName).toBe(name);
    expect(absoluteName).toBe(path);
    expect(logical, name).toEqual(absolute);
  }
});


it('the historical float32 input resolves after its global fixture copy is removed', async () => {
  const fixture = await readOracleFixture('fits/core.json');
  const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/float32.fits');
  expect(input).toBeDefined();
  if (!input) throw new Error('Missing float32 oracle input.');
  expect(await readOracleInput(input)).toEqual(await readFile(resolve(root, 'packages/fits/src/node/fixtures/fits/float32.fits')));
});

it('source and built oracle runners discover domain cases after the root tests directory is retired', () => {
  for (const path of ['packages/core/src/node/oracle/run.mts', 'packages/core/dist/oracle/run.js']) {
    const result = spawnSync(process.execPath, [resolve(root, path), '__unknown__'], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown oracle __unknown__; known:');
    expect(result.stderr).toContain('astronomy/hosted-eccentric');
    expect(result.stderr).not.toContain('ENOENT');
  }
});
