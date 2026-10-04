import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { BASELINE_PATH, buildBaseline, countModules, growth, readBaseline, validateBaseline } from './check-directory-growth.mts';

const baseline = (entry: unknown) => ({ schema: 'cssearth-directory-growth@1', allowance: 20,
  directories: { 'packages/example/src': entry } });

test('above-default implementation and advisory-test ceilings require written reasons', () => {
  for (const counts of [{ implementations: 21, tests: 0 }, { implementations: 0, tests: 21 }]) {
    const documented = baseline({ ...counts, reason: 'One coherent format owner.' });
    assert.equal(validateBaseline(documented).directories['packages/example/src']?.reason, 'One coherent format owner.');
    assert.throws(() => validateBaseline(baseline(counts)), /requires a written reason/u);
    for (const reason of ['', '  ', 7]) {
      assert.throws(() => validateBaseline(baseline({ ...counts, reason })), /non-empty string/u);
    }
  }
  assert.doesNotThrow(() => validateBaseline(baseline({ implementations: 20, tests: 20 })));
});

test('baseline rejects malformed counts and allowance bypasses', () => {
  for (const implementations of [-1, 1.5, '21', null]) {
    assert.throws(() => validateBaseline(baseline({ implementations, tests: 0, reason: 'Owner.' })), /non-negative integers/u);
  }
  assert.throws(() => validateBaseline({ ...baseline({ implementations: 20, tests: 0 }), allowance: 1000 }), /not a/u);
  assert.throws(() => validateBaseline({ ...baseline({ implementations: 20, tests: 0 }), directories: [] }), /not a/u);
});

test('baseline regeneration preserves reasons and refuses undocumented new ceilings', () => {
  const previous = validateBaseline(baseline({ implementations: 21, tests: 0, reason: 'One coherent format owner.' }));
  const counts = new Map([['packages/example/src', { implementations: 22, tests: 21 }]]);
  const rebuilt = buildBaseline(counts, previous);
  assert.deepEqual(rebuilt.directories['packages/example/src'], { implementations: 22, tests: 21, reason: 'One coherent format owner.' });
  assert.throws(() => buildBaseline(counts), /add a written reason/u);
  counts.set('packages/new/src', { implementations: 21, tests: 0 });
  assert.throws(() => buildBaseline(counts, previous), /packages\/new\/src/u);
  assert.deepEqual(buildBaseline(new Map([['packages/example/src', { implementations: 20, tests: 20 }]]), previous).directories, {});
});

test('readBaseline validates a missing reason from the real input file', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'directory-growth-'));
  try {
    await mkdir(resolve(root, '.github/scripts/checks'), { recursive: true });
    const path = resolve(root, BASELINE_PATH);
    await writeFile(path, JSON.stringify(baseline({ implementations: 21, tests: 0, reason: 'Owner.' })));
    assert.equal((await readBaseline(root)).directories['packages/example/src']?.implementations, 21);
    const before = await readFile(path, 'utf8');
    await writeFile(path, JSON.stringify(baseline({ implementations: 21, tests: 0 })));
    await assert.rejects(readBaseline(root), /requires a written reason/u);
    assert.notEqual(await readFile(path, 'utf8'), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('implementation growth gates while colocated test growth stays advisory', () => {
  const documented = validateBaseline(baseline({ implementations: 21, tests: 0, reason: 'Owner.' }));
  const counts = new Map([['packages/example/src', { implementations: 21, tests: 30 }]]);
  assert.deepEqual(growth(counts, documented), []);
  assert.deepEqual(growth(counts, documented, ['tests']), [{ directory: 'packages/example/src', kind: 'tests', was: 20, now: 30 }]);
  counts.set('packages/example/src', { implementations: 22, tests: 30 });
  assert.deepEqual(growth(counts, documented), [{ directory: 'packages/example/src', kind: 'implementations', was: 21, now: 22 }]);
});

test('module counting keeps moved tests separate and excludes declarations and prepared output', async () => {
  const counts = await countModules('.', async () => ['packages/example/src/world/reader.ts',
    'packages/example/src/world/reader.test.ts', 'packages/example/src/world/types.d.ts',
    'packages/example/prepared/reader.ts', 'packages/example/src/world/check-browser.mts']);
  assert.deepEqual([...counts], [['packages/example/src/world', { implementations: 1, tests: 2 }]]);
});
