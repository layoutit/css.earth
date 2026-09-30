import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { requireRecord, requireString } from '../../index.js';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture, fitsArchiveInputs } from './fixture.mts';

const root = projectRoot(import.meta.url);

async function relocationTables() {
  const reader = await readFile(new URL('fixture.mts', import.meta.url), 'utf8');
  const runner = await readFile(new URL('run.mts', import.meta.url), 'utf8');
  const table = /const relocatedPaths:[^=]+ = (\{[\s\S]*?\n\});/u.exec(reader);
  const generatorTable = /const relocated:[^=]+ = (\{[\s\S]*?\n\});/u.exec(runner);
  if (!table || !generatorTable) throw new Error('Expected oracle relocation tables.');
  const entries = [...table[1]!.matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
    .map(match => [match[1]!, match[2]!] as const);
  const generators = [...generatorTable[1]!.matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
    .map(match => [match[1]!, match[2]!] as const).filter(([, path]) => path.endsWith('.py'));
  return { entries, generators };
}

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  const archiveInputs = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/bake/src/objects/layers/observation/fixtures/fits/archive-inputs.json'), 'utf8'))).inputs;
  assert.deepEqual((await fitsArchiveInputs()), archiveInputs);
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),archiveInputs:await m.fitsArchiveInputs(),fixture:(await m.readOracleFixture('fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { root, pins: sourcePins, archiveInputs, fixture: (await readOracleFixture('fits/core.json')).generatedBy });
  }
  for (const name of ['fixture.py', 'requirements.txt']) {
    assert.deepEqual((await readFile(resolve(root, 'packages/core/dist/oracle', name))), await readFile(new URL(name, import.meta.url)));
  }
});

it('kernel inputs require their owner verifier and propagate its rejection', async () => {
  const inputs = [{ path: 'src/spice/new-horizons/lsk/naif0012.tls' }];
  await assert.rejects(assertPinnedInputs(inputs), /Kernel oracle inputs require the caller bank verifier\./);
  await assert.rejects(assertPinnedInputs(inputs, async (set, kernels) => {
    assert.equal(set, 'new-horizons');
    assert.deepEqual(kernels, ['lsk/naif0012.tls']);
    throw new Error('bank rejected');
  }), /bank rejected/);
});

it('the Python writer finds the module-relative root in both source and distribution', () => {
  for (const path of ['packages/core/src/node/oracle/fixture.py', 'packages/core/dist/oracle/fixture.py']) {
    const result = spawnSync('python3', ['-c',
      'import runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); print(runpy.run_path(sys.argv[1])["ROOT"])',
      fileURLToPath(new URL(path, `file://${root}/`))], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), root);
  }
});

it('every relocated generator resolves its logical output and preserves historical input identities without writing', async () => {
  const { entries, generators } = await relocationTables();
  assert.ok(generators.length > 0);
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
for historical, current in request['inputs']:
    assert m['input_record'](root / current)['path'] == historical, current
print(json.dumps({'generators': len(request['generators']), 'inputs': len(request['inputs'])}))
`, resolve(root, 'packages/core/src/node/oracle/fixture.py')], {
    cwd: tmpdir(), encoding: 'utf8', input: JSON.stringify({ outputs: entries, generators, inputs }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { generators: generators.length, inputs: inputs.length });
});

it('Python and TypeScript resolve relocated oracle fixtures to the same current files', async () => {
  const result = spawnSync('python3', ['-c',
    'import json, runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); m = runpy.run_path(sys.argv[1]); print(json.dumps({k: str(m["fixture_path"](k)) for k in sorted(m["relocated"])}))',
    resolve(root, 'packages/core/src/node/oracle/fixture.py')], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const paths: unknown = JSON.parse(result.stdout);
  assert.equal((typeof paths), 'object');
  if (!paths || typeof paths !== 'object') throw new TypeError('Expected oracle fixture paths.');
  for (const name of Object.keys(paths).sort()) {
    const path: unknown = Reflect.get(paths, name);
    if (typeof path !== 'string') throw new TypeError('Expected an oracle fixture path.');
    const { name: logicalName, ...logical } = await readOracleFixture(name);
    const { name: absoluteName, ...absolute } = await readOracleFixture(path);
    assert.equal(logicalName, name);
    assert.equal(absoluteName, path);
    assert.deepEqual(logical, absolute, name);
  }
});


it('the historical float32 input resolves after its global fixture copy is removed', async () => {
  const fixture = await readOracleFixture('fits/core.json');
  const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/float32.fits');
  assert.notEqual(input, undefined);
  if (!input) throw new Error('Missing float32 oracle input.');
  assert.deepEqual((await readOracleInput(input)), await readFile(resolve(root, 'packages/fits/src/node/fixtures/fits/float32.fits')));
});

it('source and built oracle runners discover domain cases after the root tests directory is retired', () => {
  for (const path of ['packages/core/src/node/oracle/run.mts', 'packages/core/dist/oracle/run.js']) {
    const result = spawnSync(process.execPath, [resolve(root, path), '__unknown__'], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('Unknown oracle __unknown__; known:'));
    assert.ok(result.stderr.includes('astronomy/hosted-eccentric'));
    assert.ok(!result.stderr.includes('ENOENT'));
  }
});

it('relocated fixture case paths share historical input identities without generating files', async () => {
  const { entries, generators } = await relocationTables();
  const result = spawnSync('python3', ['-B', '-c', `
import ast, json, runpy, sys, types
sys.modules['numpy'] = types.ModuleType('numpy')
m = runpy.run_path(sys.argv[1])
root = m['ROOT']
request = json.loads(sys.stdin.read())
outputs = dict(request['entries'])
case_count = expression_count = 0
def case_paths(node):
    if isinstance(node, dict):
        if 'path' in node:
            yield node['path']
        for value in node.values():
            yield from case_paths(value)
    elif isinstance(node, list):
        for value in node:
            yield from case_paths(value)
for historical, current in request['entries']:
    if not historical.startswith('tests/oracles/') or not current.endswith('.json'): continue
    fixture = json.loads((root / current).read_text())
    if 'inputs' not in fixture: continue
    inputs = {record['path'] for record in fixture['inputs']}
    for path in case_paths(fixture['cases']):
        assert path in inputs, (current, path, 'case path missing from inputs')
        assert path not in outputs.values(), (current, path, 'case path is relocated, not historical')
        # Body/archive inputs retain their original names and can be absent locally.
        # Every moved input must have a historical name mapping to a resident file.
        if path.startswith('tests/fixtures/'):
            assert path in outputs and (root / outputs[path]).is_file(), (current, path)
        case_count += 1
for logical, generator in request['generators']:
    tree = ast.parse((root / generator).read_text())
    fixture = json.loads(m['fixture_path'](logical + '.json').read_text())
    paths = list(case_paths(fixture['cases']))
    expressions = [value for node in ast.walk(tree) if isinstance(node, ast.Dict)
        for key, value in zip(node.keys, node.values)
        if isinstance(key, ast.Constant) and key.value == 'path'
        and any(isinstance(n, ast.Name) and n.id == 'path' for n in ast.walk(value))]
    for expression in expressions:
        for historical in paths:
            if historical not in outputs: continue
            actual = eval(compile(ast.Expression(expression), generator, 'eval'),
                {'path': root / outputs[historical], 'ROOT': root, 'input_record': m['input_record']})
            assert actual == historical, (generator, actual, historical)
            expression_count += 1
assert case_count > 0 and expression_count > 0
print(json.dumps({'cases': case_count, 'expressions': expression_count}))
`, resolve(root, 'packages/core/src/node/oracle/fixture.py')], {
    cwd: tmpdir(), encoding: 'utf8', input: JSON.stringify({ entries, generators }),
  });
  assert.equal(result.status, 0, result.stderr);
  const evidence = requireRecord(JSON.parse(result.stdout));
  assert.ok(Number(evidence.cases) > 0);
  assert.ok(Number(evidence.expressions) > 0);
});

it('relocated generators serialize paths through input_record rather than physical locations', async () => {
  const { generators } = await relocationTables();
  const result = spawnSync('python3', ['-B', '-c', `
import ast, json, pathlib, sys
request = json.loads(sys.stdin.read())
for logical, generator in request['generators']:
    tree = ast.parse((pathlib.Path(sys.argv[1]) / generator).read_text())
    parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call): continue
        relative = isinstance(node.func, ast.Attribute) and node.func.attr == 'relative_to' and any(
            isinstance(arg, ast.Name) and arg.id == 'ROOT' for arg in node.args)
        physical = (isinstance(node.func, ast.Name) and node.func.id == 'str' and len(node.args) == 1
            and isinstance(node.args[0], ast.Name) and node.args[0].id == 'path') or (
            isinstance(node.func, ast.Attribute) and node.func.attr == 'as_posix')
        if not (relative or physical): continue
        cursor = node
        protected = serialized = False
        while cursor in parents:
            parent = parents[cursor]
            if isinstance(parent, ast.Call) and isinstance(parent.func, ast.Name) and parent.func.id == 'input_record':
                protected = True
            if isinstance(parent, ast.Dict):
                serialized = serialized or cursor in parent.keys or any(
                    isinstance(key, ast.Constant) and key.value == 'path' and value is cursor
                    for key, value in zip(parent.keys, parent.values))
            if isinstance(parent, ast.Subscript) and parent.slice is cursor:
                serialized = True
            cursor = parent
        # ROOT-relative conversions are forbidden in generators; the shared writer owns the reverse map.
        assert protected or not (relative or serialized), (generator, node.lineno, 'use input_record(path)["path"]')
print(json.dumps({'generators': len(request['generators'])}))
`, root], { cwd: tmpdir(), encoding: 'utf8', input: JSON.stringify({ generators }) });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { generators: generators.length });
});

it('fixture_path accepts known relocated Paths and explains the logical-name convention for other Paths', () => {
  const result = spawnSync('python3', ['-B', '-c', `
import pathlib, runpy, sys, types
sys.modules['numpy'] = types.ModuleType('numpy')
m = runpy.run_path(sys.argv[1])
for logical, current in m['relocated'].items():
    assert m['fixture_path'](m['ROOT'] / current) == m['fixture_path'](logical)
assert m['fixture_path']('unmoved/example.json') == m['ROOT'] / 'tests/oracles/unmoved/example.json'
for path in [m['ROOT'] / 'unknown.json', pathlib.Path('/tmp/unknown.json')]:
    try:
        m['fixture_path'](path)
    except ValueError as error:
        assert str(error) == "fixture_path expects a logical name such as 'fits/core.json' or a Path to a known relocated fixture."
    else:
        raise AssertionError(path)
print('known Paths resolved; unknown Paths rejected; strings unchanged')
`, resolve(root, 'packages/core/src/node/oracle/fixture.py')], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'known Paths resolved; unknown Paths rejected; strings unchanged');
});
